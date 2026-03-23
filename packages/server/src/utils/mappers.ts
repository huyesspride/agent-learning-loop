import type { ImprovementRow } from '../db/queries/improvements.js';
import type { RuleRow } from '../db/queries/rules.js';
import type { SessionRow } from '../db/queries/sessions.js';

/** Map ImprovementRow (snake_case) → Improvement (camelCase) */
export function mapImprovement(row: ImprovementRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    sourceId: row.source_id,
    category: row.category,
    severity: row.severity,
    whatHappened: row.what_happened,
    userCorrection: row.user_correction ?? undefined,
    suggestedRule: row.suggested_rule,
    applyTo: row.apply_to,
    status: row.status,
    editedRule: row.edited_rule ?? undefined,
    conflictWith: row.conflict_with ? row.conflict_with.split(',').filter(Boolean) : undefined,
    note: row.note ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    appliedAt: row.applied_at ?? undefined,
    createdAt: row.created_at,
  };
}

/** Map RuleRow (snake_case) → Rule (camelCase) */
export function mapRule(row: RuleRow) {
  return {
    id: row.id,
    sourceId: row.source_id,
    target: row.target,
    projectPath: row.project_path ?? undefined,
    content: row.content,
    note: row.note ?? undefined,
    category: row.category ?? undefined,
    originImprovementId: row.origin_improvement_id ?? undefined,
    addedAt: row.added_at,
    effectivenessScore: row.effectiveness_score ?? undefined,
    effectivenessBaselineRate: row.effectiveness_baseline_rate ?? undefined,
    effectivenessSampleCount: row.effectiveness_sample_count,
    status: row.status,
  };
}

/** Map SessionRow (snake_case) → Session (camelCase) */
export function mapSession(row: SessionRow) {
  return {
    id: row.id,
    sourceId: row.source_id,
    projectPath: row.project_path,
    sessionPath: row.session_path,
    startedAt: row.started_at,
    messageCount: row.message_count,
    userMessageCount: row.user_message_count,
    correctionCount: row.correction_count,
    analyzedAt: row.analyzed_at ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}
