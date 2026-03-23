import Database from 'better-sqlite3';

export interface RunRow {
  id: number;
  run_type: string;
  started_at: string | null;
  completed_at: string | null;
  status: string | null;
  stats: string | null;
  error: string | null;
  prompt_version: string | null;
}

export function startRun(db: Database.Database, runType: string): number {
  const stmt = db.prepare(`
    INSERT INTO runs (run_type, started_at, status)
    VALUES (?, datetime('now'), 'running')
  `);
  const result = stmt.run(runType);
  return result.lastInsertRowid as number;
}

export function completeRun(
  db: Database.Database,
  id: number,
  status: string,
  stats?: Record<string, number>
): void {
  const stmt = db.prepare(`
    UPDATE runs SET completed_at = datetime('now'), status = ?, stats = ? WHERE id = ?
  `);
  stmt.run(status, stats ? JSON.stringify(stats) : null, id);
}

export function failRun(db: Database.Database, id: number, error: string): void {
  const stmt = db.prepare(`
    UPDATE runs SET completed_at = datetime('now'), status = 'failed', error = ? WHERE id = ?
  `);
  stmt.run(error, id);
}

export function getRecentRuns(db: Database.Database, limit = 20): RunRow[] {
  const stmt = db.prepare(`SELECT * FROM runs ORDER BY id DESC LIMIT ?`);
  return stmt.all(limit) as RunRow[];
}
