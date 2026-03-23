import Database from 'better-sqlite3';

export interface ImprovementRow {
  id: string;
  session_id: string | null;
  source_id: string;
  category: string;
  severity: string;
  what_happened: string;
  user_correction: string | null;
  suggested_rule: string;
  apply_to: string;
  status: string;
  edited_rule: string | null;
  conflict_with: string | null;
  note: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  created_at: string;
}

export function insertImprovement(
  db: Database.Database,
  improvement: {
    id: string;
    sessionId?: string;
    sourceId?: string;
    category: string;
    severity: string;
    whatHappened: string;
    userCorrection?: string;
    suggestedRule: string;
    applyTo?: string;
    status?: string;
    editedRule?: string;
    conflictWith?: string;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO improvements (id, session_id, source_id, category, severity, what_happened, user_correction, suggested_rule, apply_to, status, edited_rule, conflict_with)
    VALUES (@id, @session_id, @source_id, @category, @severity, @what_happened, @user_correction, @suggested_rule, @apply_to, @status, @edited_rule, @conflict_with)
  `);
  stmt.run({
    id: improvement.id,
    session_id: improvement.sessionId ?? null,
    source_id: improvement.sourceId ?? 'claude_code',
    category: improvement.category,
    severity: improvement.severity,
    what_happened: improvement.whatHappened,
    user_correction: improvement.userCorrection ?? null,
    suggested_rule: improvement.suggestedRule,
    apply_to: improvement.applyTo ?? 'claude_md',
    status: improvement.status ?? 'pending',
    edited_rule: improvement.editedRule ?? null,
    conflict_with: improvement.conflictWith ?? null,
  });
}

export function updateImprovementStatus(
  db: Database.Database,
  id: string,
  status: string,
  extra?: {
    editedRule?: string;
    conflictWith?: string;
    note?: string;
    reviewedAt?: string;
    appliedAt?: string;
  }
): void {
  const sets: string[] = ['status = @status'];
  const params: Record<string, unknown> = { id, status };

  if (extra?.editedRule !== undefined) {
    sets.push('edited_rule = @edited_rule');
    params['edited_rule'] = extra.editedRule;
  }
  if (extra?.conflictWith !== undefined) {
    sets.push('conflict_with = @conflict_with');
    params['conflict_with'] = extra.conflictWith;
  }
  if (extra?.note !== undefined) {
    sets.push('note = @note');
    params['note'] = extra.note;
  }
  if (extra?.reviewedAt !== undefined) {
    sets.push('reviewed_at = @reviewed_at');
    params['reviewed_at'] = extra.reviewedAt;
  }
  if (extra?.appliedAt !== undefined) {
    sets.push('applied_at = @applied_at');
    params['applied_at'] = extra.appliedAt;
  }

  const stmt = db.prepare(`UPDATE improvements SET ${sets.join(', ')} WHERE id = @id`);
  stmt.run(params);
}

export function findImprovements(
  db: Database.Database,
  filters?: { status?: string; category?: string; severity?: string }
): ImprovementRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters?.severity) {
    conditions.push('severity = ?');
    params.push(filters.severity);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT * FROM improvements ${where} ORDER BY created_at DESC`);
  return stmt.all(...params) as ImprovementRow[];
}

export function findImprovementById(db: Database.Database, id: string): ImprovementRow | undefined {
  const stmt = db.prepare(`SELECT * FROM improvements WHERE id = ?`);
  return stmt.get(id) as ImprovementRow | undefined;
}

export function countPendingImprovements(db: Database.Database): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM improvements WHERE status = 'pending'`).get() as { count: number };
  return row.count;
}
