import { randomUUID } from 'crypto';
import { join } from 'path';
import type Database from 'better-sqlite3';
import { claudeMdTarget, memoryTarget, BackupManager, buildInstructionFile } from './index.js';
import { improvementQueries, ruleQueries } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import type { RuleChange } from '@cll/shared';

export interface ApplyOptions {
  dryRun?: boolean;
  runId?: number;
}

export interface ApplyResult {
  applied: number;
  backupId: number;
  changes: RuleChange[];
}

export interface DryRunResult {
  before: string;
  after: string;
  changes: RuleChange[];
}

export class Applier {
  constructor(private db: Database.Database) {}

  async dryRun(improvementIds: string[]): Promise<DryRunResult> {
    const improvements = this.loadApprovedImprovements(improvementIds);

    const byTarget = groupByTarget(improvements);
    const changes: RuleChange[] = [];
    let before = '';
    let after = '';

    for (const [target, imps] of Object.entries(byTarget)) {
      const targetHandler = getTarget(target);
      const filePath = getDefaultFilePath(target);
      const current = targetHandler.read(filePath);
      before = current.rawContent || '';

      const newRules = imps.map((imp) => imp.edited_rule || imp.suggested_rule);
      const newFile = {
        ...current,
        cllRules: [...current.cllRules, ...newRules],
        ruleCount: current.cllRules.length + newRules.length,
      };

      // Dry run: no actual write
      targetHandler.write(filePath, newFile, { dryRun: true });

      after = buildInstructionFile(newFile);

      for (const imp of imps) {
        changes.push({
          action: 'add',
          rule: imp.edited_rule || imp.suggested_rule,
          category: imp.category,
          target: target as 'claude_md' | 'memory',
        });
      }
    }

    return { before, after, changes };
  }

  async apply(improvementIds: string[], options: ApplyOptions = {}): Promise<ApplyResult> {
    const improvements = this.loadApprovedImprovements(improvementIds);
    if (improvements.length === 0) {
      throw new Error('No approved improvements to apply');
    }

    const byTarget = groupByTarget(improvements);
    const changes: RuleChange[] = [];
    let backupId = -1;

    const backupManager = new BackupManager(this.db);

    for (const [target, imps] of Object.entries(byTarget)) {
      const targetHandler = getTarget(target);
      const filePath = getDefaultFilePath(target);

      // Create backup before writing
      if (!options.dryRun) {
        const bid = backupManager.backup(filePath, 'pre_apply', options.runId);
        if (bid > 0) backupId = bid;
      }

      // Read current file
      const current = targetHandler.read(filePath);
      const newRules = imps.map((imp) => imp.edited_rule || imp.suggested_rule);

      const newFile = {
        ...current,
        cllRules: [...current.cllRules, ...newRules],
        ruleCount: current.cllRules.length + newRules.length,
        wordCount: 0, // recalculated in write
      };

      // Write to file
      targetHandler.write(filePath, newFile, { dryRun: options.dryRun });

      // Update improvements status and insert active rules
      for (const imp of imps) {
        if (!options.dryRun) {
          improvementQueries.updateImprovementStatus(this.db, imp.id, 'applied', {
            appliedAt: new Date().toISOString(),
          });

          ruleQueries.insertRule(this.db, {
            id: randomUUID(),
            target: target,
            content: imp.edited_rule || imp.suggested_rule,
            category: imp.category,
            originImprovementId: imp.id,
          });
        }

        changes.push({
          action: 'add',
          rule: imp.edited_rule || imp.suggested_rule,
          category: imp.category,
          target: target as 'claude_md' | 'memory',
        });
      }
    }

    logger.info('Applied improvements', { count: improvements.length, changes: changes.length });

    return {
      applied: improvements.length,
      backupId,
      changes,
    };
  }

  private loadApprovedImprovements(ids: string[]) {
    return ids
      .map((id) => improvementQueries.findImprovementById(this.db, id))
      .filter((imp): imp is NonNullable<typeof imp> => imp !== undefined)
      .filter((imp) => imp.status === 'approved' || imp.status === 'edited');
  }
}

function groupByTarget(improvements: ReturnType<typeof improvementQueries.findImprovements>): Record<string, ReturnType<typeof improvementQueries.findImprovements>> {
  const result: Record<string, ReturnType<typeof improvementQueries.findImprovements>> = {};
  for (const imp of improvements) {
    const target = imp.apply_to || 'claude_md';
    if (!result[target]) result[target] = [];
    result[target].push(imp);
  }
  return result;
}

function getTarget(target: string) {
  if (target === 'memory') return memoryTarget;
  return claudeMdTarget;
}

function getDefaultFilePath(target: string): string {
  if (target === 'memory') return memoryTarget.getDefaultPath();
  return join(process.cwd(), 'CLAUDE.md');
}
