import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { getClaudeClient } from '../../claude/client.js';
import { ruleQueries } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { buildOptimizerPrompt, buildOptimizerSystemPrompt } from './prompts.js';
import type { SseStream } from '../../utils/sse.js';
import type { OptimizerAction } from './prompts.js';

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

    // Load active rules
    const rules = ruleQueries.findActiveRules(this.db);
    if (rules.length === 0) {
      logger.info('No rules to optimize');
      this.sse?.close();
      return { kept: 0, merged: 0, rewritten: 0, retired: 0, unchanged: 0 };
    }

    this.sse?.send('progress', { phase: 'analyze', ruleCount: rules.length });

    // Build prompt
    const rulesWithStats = rules.map(r => ({
      id: r.id,
      content: r.content,
      category: r.category ?? undefined,
      effectivenessScore: r.effectiveness_score ?? undefined,
      effectivenessSampleCount: r.effectiveness_sample_count ?? 0,
      status: r.status,
    }));

    const prompt = buildOptimizerPrompt(rulesWithStats, { maxRules, maxWords });
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

    // Parse actions
    const actions = parseOptimizerResponse(responseText);
    logger.info('Optimizer actions', { count: actions.length });

    const result: OptimizeResult = { kept: 0, merged: 0, rewritten: 0, retired: 0, unchanged: 0 };

    if (!dryRun) {
      for (const action of actions) {
        switch (action.action) {
          case 'KEEP':
            result.kept++;
            break;

          case 'RETIRE':
            if (action.id) {
              ruleQueries.deleteRule(this.db, action.id); // soft-delete (sets status='retired')
              result.retired++;
            }
            break;

          case 'REWRITE':
            if (action.id && action.newText) {
              ruleQueries.updateRule(this.db, action.id, { content: action.newText });
              result.rewritten++;
            }
            break;

          case 'MERGE':
            if (action.ids && action.ids.length > 0 && action.newText) {
              // Retire all merged rules
              for (const id of action.ids) {
                ruleQueries.deleteRule(this.db, id);
              }
              // Insert merged rule
              ruleQueries.insertRule(this.db, {
                id: randomUUID(),
                content: action.newText,
                target: 'claude_md',
                category: rules.find(r => r.id === action.ids![0])?.category ?? undefined,
              });
              result.merged++;
            }
            break;
        }
      }
    }

    result.unchanged = rules.length - result.kept - result.merged - result.rewritten - result.retired;
    if (result.unchanged < 0) result.unchanged = 0;

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
