import Database from 'better-sqlite3';

export interface RuleRow {
  id: string;
  source_id: string | null;
  target: string;
  project_path: string | null;
  content: string;
  category: string | null;
  origin_improvement_id: string | null;
  added_at: string;
  effectiveness_score: number | null;
  effectiveness_baseline_rate: number | null;
  effectiveness_sample_count: number;
  status: string;
}

export function insertRule(
  db: Database.Database,
  rule: {
    id: string;
    sourceId?: string;
    target: string;
    projectPath?: string;
    content: string;
    category?: string;
    originImprovementId?: string;
    effectivenessScore?: number;
    effectivenessBaselineRate?: number;
    effectivenessSampleCount?: number;
    status?: string;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO active_rules (id, source_id, target, project_path, content, category, origin_improvement_id, effectiveness_score, effectiveness_baseline_rate, effectiveness_sample_count, status)
    VALUES (@id, @source_id, @target, @project_path, @content, @category, @origin_improvement_id, @effectiveness_score, @effectiveness_baseline_rate, @effectiveness_sample_count, @status)
  `);
  stmt.run({
    id: rule.id,
    source_id: rule.sourceId ?? null,
    target: rule.target,
    project_path: rule.projectPath ?? null,
    content: rule.content,
    category: rule.category ?? null,
    origin_improvement_id: rule.originImprovementId ?? null,
    effectiveness_score: rule.effectivenessScore ?? null,
    effectiveness_baseline_rate: rule.effectivenessBaselineRate ?? null,
    effectiveness_sample_count: rule.effectivenessSampleCount ?? 0,
    status: rule.status ?? 'active',
  });
}

export function updateRule(
  db: Database.Database,
  id: string,
  updates: {
    content?: string;
    category?: string;
    target?: string;
    effectivenessScore?: number;
    effectivenessBaselineRate?: number;
    effectivenessSampleCount?: number;
    status?: string;
  }
): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.content !== undefined) {
    sets.push('content = @content');
    params['content'] = updates.content;
  }
  if (updates.category !== undefined) {
    sets.push('category = @category');
    params['category'] = updates.category;
  }
  if (updates.target !== undefined) {
    sets.push('target = @target');
    params['target'] = updates.target;
  }
  if (updates.effectivenessScore !== undefined) {
    sets.push('effectiveness_score = @effectiveness_score');
    params['effectiveness_score'] = updates.effectivenessScore;
  }
  if (updates.effectivenessBaselineRate !== undefined) {
    sets.push('effectiveness_baseline_rate = @effectiveness_baseline_rate');
    params['effectiveness_baseline_rate'] = updates.effectivenessBaselineRate;
  }
  if (updates.effectivenessSampleCount !== undefined) {
    sets.push('effectiveness_sample_count = @effectiveness_sample_count');
    params['effectiveness_sample_count'] = updates.effectivenessSampleCount;
  }
  if (updates.status !== undefined) {
    sets.push('status = @status');
    params['status'] = updates.status;
  }

  if (sets.length === 0) return;
  const stmt = db.prepare(`UPDATE active_rules SET ${sets.join(', ')} WHERE id = @id`);
  stmt.run(params);
}

export function deleteRule(db: Database.Database, id: string): void {
  const stmt = db.prepare(`UPDATE active_rules SET status = 'retired' WHERE id = ?`);
  stmt.run(id);
}

export function findActiveRules(
  db: Database.Database,
  filters?: { category?: string; target?: string }
): RuleRow[] {
  const conditions: string[] = ["status = 'active'"];
  const params: unknown[] = [];

  if (filters?.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters?.target) {
    conditions.push('target = ?');
    params.push(filters.target);
  }

  const stmt = db.prepare(`SELECT * FROM active_rules WHERE ${conditions.join(' AND ')} ORDER BY added_at DESC`);
  return stmt.all(...params) as RuleRow[];
}

export function findRuleById(db: Database.Database, id: string): RuleRow | undefined {
  const stmt = db.prepare(`SELECT * FROM active_rules WHERE id = ?`);
  return stmt.get(id) as RuleRow | undefined;
}
