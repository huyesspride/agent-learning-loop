import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database.Database): void {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Incremental migrations — safe to re-run
  try { db.exec(`ALTER TABLE active_rules ADD COLUMN note TEXT`); } catch (_e) { /* already exists */ }
  try { db.exec(`ALTER TABLE improvements ADD COLUMN note TEXT`); } catch (_e) { /* already exists */ }
}
