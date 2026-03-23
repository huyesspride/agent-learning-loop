import Database from 'better-sqlite3';

export interface BackupRow {
  id: number;
  file_path: string;
  content: string;
  backup_type: string;
  run_id: number | null;
  created_at: string;
}

export function createBackup(
  db: Database.Database,
  backup: {
    filePath: string;
    content: string;
    backupType: string;
    runId?: number;
  }
): number {
  const stmt = db.prepare(`
    INSERT INTO backups (file_path, content, backup_type, run_id)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(backup.filePath, backup.content, backup.backupType, backup.runId ?? null);
  return result.lastInsertRowid as number;
}

export function getBackup(db: Database.Database, id: number): BackupRow | undefined {
  const stmt = db.prepare(`SELECT * FROM backups WHERE id = ?`);
  return stmt.get(id) as BackupRow | undefined;
}

export function listBackups(db: Database.Database, filePath?: string, limit = 20): BackupRow[] {
  if (filePath) {
    const stmt = db.prepare(`SELECT * FROM backups WHERE file_path = ? ORDER BY created_at DESC LIMIT ?`);
    return stmt.all(filePath, limit) as BackupRow[];
  }
  const stmt = db.prepare(`SELECT * FROM backups ORDER BY created_at DESC LIMIT ?`);
  return stmt.all(limit) as BackupRow[];
}
