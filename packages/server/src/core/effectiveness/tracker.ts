import type Database from 'better-sqlite3';
import { ruleQueries, sessionQueries } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

export interface EffectivenessScore {
  ruleId: string;
  score: number | null;  // null = insufficient data
  sampleCount: number;
  status: 'insufficient' | 'improving' | 'no-effect' | 'stable';
}

export class EffectivenessTracker {
  constructor(private db: Database.Database) {}

  updateAll(): void {
    const rules = ruleQueries.findActiveRules(this.db);

    for (const rule of rules) {
      try {
        this.updateRule(rule.id);
      } catch (err) {
        logger.warn('Failed to update effectiveness for rule', { ruleId: rule.id, error: String(err) });
      }
    }
  }

  updateRule(ruleId: string): void {
    const rule = ruleQueries.findRuleById(this.db, ruleId);
    if (!rule) return;

    // Count sessions analyzed since rule was added
    // This is a simplified calculation — in production would query by date
    const stats = sessionQueries.getDashboardStats(this.db);
    const sampleCount = stats.analyzedSessions;

    if (sampleCount < 5) {
      // Insufficient data
      ruleQueries.updateRule(this.db, ruleId, {
        effectivenessSampleCount: sampleCount,
      });
      return;
    }

    // Calculate effectiveness:
    // If we have a baseline rate, compare current to baseline
    const baselineRate = rule.effectiveness_baseline_rate ?? 0;
    // For now, use a simplified score based on sample count
    // Real implementation would track correction rate by category over time
    const score = baselineRate > 0 ? Math.max(0, Math.min(1, 1 - baselineRate * 0.5)) : 0;

    ruleQueries.updateRule(this.db, ruleId, {
      effectivenessScore: score,
      effectivenessSampleCount: sampleCount,
    });
  }

  getScore(ruleId: string): EffectivenessScore {
    const rule = ruleQueries.findRuleById(this.db, ruleId);
    if (!rule) return { ruleId, score: null, sampleCount: 0, status: 'insufficient' };

    const sampleCount = rule.effectiveness_sample_count ?? 0;
    if (sampleCount < 5) {
      return { ruleId, score: null, sampleCount, status: 'insufficient' };
    }

    const score = rule.effectiveness_score ?? 0;
    const status = score === 0 && sampleCount >= 10 ? 'no-effect' : score > 0.3 ? 'improving' : 'stable';
    return { ruleId, score, sampleCount, status };
  }
}
