import { readFileSync, writeFileSync, existsSync } from 'fs';
import type Database from 'better-sqlite3';
import { backupQueries } from '../../db/index.js';

export class BackupManager {
  constructor(private db: Database.Database) {}

  backup(filePath: string, type: 'pre_apply' | 'manual', runId?: number): number {
    if (!existsSync(filePath)) return -1;
    const content = readFileSync(filePath, 'utf-8');
    return backupQueries.createBackup(this.db, { filePath, content, backupType: type, runId });
  }

  restore(backupId: number, targetPath?: string): void {
    const backup = backupQueries.getBackup(this.db, backupId);
    if (!backup) throw new Error(`Backup ${backupId} not found`);
    writeFileSync(targetPath ?? backup.file_path, backup.content, 'utf-8');
  }

  listBackups(
    filePath?: string,
    limit = 20,
  ): Array<{ id: number; filePath: string; backupType: string; createdAt: string }> {
    return backupQueries.listBackups(this.db, filePath, limit).map((b) => ({
      id: b.id,
      filePath: b.file_path,
      backupType: b.backup_type,
      createdAt: b.created_at,
    }));
  }
}
