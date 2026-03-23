import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { runMigrations } from './migrations.js';
import * as sessionQueries from './queries/sessions.js';
import * as improvementQueries from './queries/improvements.js';
import * as ruleQueries from './queries/rules.js';
import * as runQueries from './queries/runs.js';
import * as backupQueries from './queries/backups.js';

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;
  const path = dbPath ?? join(homedir(), '.cll', 'cll.db');
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);
  return _db;
}

export { sessionQueries, improvementQueries, ruleQueries, runQueries, backupQueries };
