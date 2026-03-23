import Database from 'better-sqlite3';

export interface SessionRow {
  id: string;
  source_id: string;
  project_path: string;
  session_path: string;
  started_at: string | null;
  message_count: number;
  user_message_count: number;
  correction_count: number;
  analyzed_at: string | null;
  status: string;
  created_at: string;
}

export function insertSession(
  db: Database.Database,
  session: {
    id: string;
    sourceId?: string;
    projectPath: string;
    sessionPath: string;
    startedAt?: string;
    messageCount?: number;
    userMessageCount?: number;
    correctionCount?: number;
    status?: string;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, source_id, project_path, session_path, started_at, message_count, user_message_count, correction_count, status)
    VALUES (@id, @source_id, @project_path, @session_path, @started_at, @message_count, @user_message_count, @correction_count, @status)
  `);
  stmt.run({
    id: session.id,
    source_id: session.sourceId ?? 'claude_code',
    project_path: session.projectPath,
    session_path: session.sessionPath,
    started_at: session.startedAt ?? null,
    message_count: session.messageCount ?? 0,
    user_message_count: session.userMessageCount ?? 0,
    correction_count: session.correctionCount ?? 0,
    status: session.status ?? 'pending',
  });
}

export function updateSessionStatus(
  db: Database.Database,
  id: string,
  status: string,
  extra?: {
    analyzedAt?: string;
    correctionCount?: number;
    messageCount?: number;
    userMessageCount?: number;
  }
): void {
  const sets: string[] = ['status = @status'];
  const params: Record<string, unknown> = { id, status };

  if (extra?.analyzedAt !== undefined) {
    sets.push('analyzed_at = @analyzed_at');
    params['analyzed_at'] = extra.analyzedAt;
  }
  if (extra?.correctionCount !== undefined) {
    sets.push('correction_count = @correction_count');
    params['correction_count'] = extra.correctionCount;
  }
  if (extra?.messageCount !== undefined) {
    sets.push('message_count = @message_count');
    params['message_count'] = extra.messageCount;
  }
  if (extra?.userMessageCount !== undefined) {
    sets.push('user_message_count = @user_message_count');
    params['user_message_count'] = extra.userMessageCount;
  }

  const stmt = db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = @id`);
  stmt.run(params);
}

export function findUnanalyzedSessions(db: Database.Database, limit = 50): SessionRow[] {
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?
  `);
  return stmt.all(limit) as SessionRow[];
}

export function findSessionByPath(db: Database.Database, sessionPath: string): SessionRow | undefined {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE session_path = ?`);
  return stmt.get(sessionPath) as SessionRow | undefined;
}

export function getDashboardStats(db: Database.Database): {
  totalSessions: number;
  analyzedSessions: number;
  pendingSessions: number;
} {
  const total = (db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as { count: number }).count;
  const analyzed = (db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE status = 'analyzed'`).get() as { count: number }).count;
  const pending = (db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE status = 'pending'`).get() as { count: number }).count;
  return {
    totalSessions: total,
    analyzedSessions: analyzed,
    pendingSessions: pending,
  };
}
