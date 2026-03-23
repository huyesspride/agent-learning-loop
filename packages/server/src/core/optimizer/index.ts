import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getClaudeClient } from '../../claude/client.js';
import { ruleQueries } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { buildOptimizerPrompt, buildOptimizerSystemPrompt } from './prompts.js';
import type { SseStream } from '../../utils/sse.js';
import type { OptimizerAction } from './prompts.js';
import { extractManualRules, applyManualRuleChanges } from '../applier/claude-md.js';
import type { ManualRule } from '../applier/claude-md.js';
import { CLAUDE_MD_PATH } from '../../utils/paths.js';

export interface OptimizeOptions {
  maxRules?: number;
  maxWords?: number;
  dryRun?: boolean;
}

export interface OptimizeResult {
  kept: number;
  merged: number;
  rewritten: number;
  retired: number;
  unchanged: number;
}

export class Optimizer {
  constructor(
    private db: Database.Database,
    private sse?: SseStream,
  ) {}

  async optimize(options: OptimizeOptions = {}): Promise<OptimizeResult> {
    const { maxRules = 50, maxWords = 1000, dryRun = false } = options;

    // Load CLL rules from DB
    const dbRules = ruleQueries.findActiveRules(this.db);

    // Load manual rules from ~/.claude/CLAUDE.md
    let manualRules: ManualRule[] = [];
    if (existsSync(CLAUDE_MD_PATH)) {
      manualRules = extractManualRules(readFileSync(CLAUDE_MD_PATH, 'utf-8'));
    }

    if (dbRules.length === 0 && manualRules.length === 0) {
      logger.info('No rules to optimize');
      this.sse?.close();
      return { kept: 0, merged: 0, rewritten: 0, retired: 0, unchanged: 0 };
    }

    const totalRules = dbRules.length + manualRules.length;
    this.sse?.send('progress', { phase: 'analyze', ruleCount: totalRules });

    // Build unified rule list: CLL rules first, then manual
    const cllForOptimizer = dbRules.map(r => ({
      id: r.id,
      content: r.content,
      category: r.category ?? undefined,
      effectivenessScore: r.effectiveness_score ?? undefined,
      effectivenessSampleCount: r.effectiveness_sample_count ?? 0,
      status: r.status,
      source: 'cll' as const,
    }));

    const manualForOptimizer = manualRules.map(r => ({
      id: r.syntheticId,
      content: r.content,
      category: r.section,
      effectivenessScore: undefined,
      effectivenessSampleCount: 0,
      status: 'active',
      source: 'manual' as const,
    }));

    const prompt = buildOptimizerPrompt([...cllForOptimizer, ...manualForOptimizer], { maxRules, maxWords });
    const systemPrompt = buildOptimizerSystemPrompt();

    const client = getClaudeClient();
    let responseText: string;

    try {
      const response = await client.call({ prompt, systemPrompt });
      responseText = response.content;
    } catch (err) {
      logger.error('Optimizer Claude call failed', { error: String(err) });
      this.sse?.send('progress', { phase: 'error', error: String(err) });
      this.sse?.close();
      throw err;
    }

    const actions = parseOptimizerResponse(responseText);
    logger.info('Optimizer actions', { count: actions.length });

    const result: OptimizeResult = { kept: 0, merged: 0, rewritten: 0, retired: 0, unchanged: 0 };

    const manualById = new Map(manualRules.map(r => [r.syntheticId, r]));
    const manualChanges = new Map<string, { action: 'retire' | 'rewrite'; newText?: string }>();

    if (!dryRun) {
      for (const action of actions) {
        switch (action.action) {
          case 'KEEP':
            result.kept++;
            break;

          case 'RETIRE': {
            const id = action.id;
            if (!id) break;
            if (manualById.has(id)) {
              manualChanges.set(manualById.get(id)!.content, { action: 'retire' });
            } else {
              ruleQueries.deleteRule(this.db, id);
            }
            result.retired++;
            break;
          }

          case 'REWRITE': {
            const id = action.id;
            if (!id || !action.newText) break;
            if (manualById.has(id)) {
              manualChanges.set(manualById.get(id)!.content, { action: 'rewrite', newText: action.newText });
            } else {
              ruleQueries.updateRule(this.db, id, { content: action.newText });
            }
            result.rewritten++;
            break;
          }

          case 'MERGE': {
            const { ids, newText } = action;
            if (!ids || ids.length === 0 || !newText) break;
            for (const id of ids) {
              if (manualById.has(id)) {
                manualChanges.set(manualById.get(id)!.content, { action: 'retire' });
              } else {
                ruleQueries.deleteRule(this.db, id);
              }
            }
            // Merged rule lands in CLL block
            ruleQueries.insertRule(this.db, {
              id: randomUUID(),
              content: newText,
              target: 'claude_md',
              category: dbRules.find(r => r.id === ids[0])?.category ?? undefined,
            });
            result.merged++;
            break;
          }
        }
      }

      // Apply changes to the manual sections of ~/.claude/CLAUDE.md
      if (manualChanges.size > 0 && existsSync(CLAUDE_MD_PATH)) {
        const raw = readFileSync(CLAUDE_MD_PATH, 'utf-8');
        writeFileSync(CLAUDE_MD_PATH, applyManualRuleChanges(raw, manualChanges), 'utf-8');
        logger.info('Manual CLAUDE.md rules updated', { changes: manualChanges.size });
      }
    }

    result.unchanged = Math.max(0, totalRules - result.kept - result.merged - result.rewritten - result.retired);

    this.sse?.send('progress', { phase: 'complete', ...result });
    this.sse?.close();

    logger.info('Optimizer complete', result);
    return result;
  }
}

function parseOptimizerResponse(text: string): OptimizerAction[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a: unknown) => a && typeof (a as OptimizerAction).action === 'string') as OptimizerAction[];
  } catch {
    return [];
  }
}

export const createOptimizer = (db: Database.Database, sse?: SseStream) => new Optimizer(db, sse);
