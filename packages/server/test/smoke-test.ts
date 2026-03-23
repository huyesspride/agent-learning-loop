/**
 * Smoke test: verifies that getDb() creates a DB with all 6 expected tables.
 */
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getDb } from '../src/db/index.js';

const dbPath = join(tmpdir(), `cll-smoke-${randomUUID()}.db`);

// Reset singleton for test isolation
// @ts-expect-error accessing module internals for test
// We bypass by importing getDb with a fresh path
const db = getDb(dbPath);

const EXPECTED_TABLES = [
  'sessions',
  'improvements',
  'active_rules',
  'runs',
  'context_snapshots',
  'backups',
];

const rows = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .all() as Array<{ name: string }>;

const tableNames = rows.map((r) => r.name);

let allPassed = true;
for (const table of EXPECTED_TABLES) {
  const found = tableNames.includes(table);
  console.log(`  [${found ? 'OK' : 'FAIL'}] table: ${table}`);
  if (!found) allPassed = false;
}

// Verify WAL mode
const walMode = (db.pragma('journal_mode') as Array<{ journal_mode: string }>)[0]?.journal_mode;
const walOk = walMode === 'wal';
console.log(`  [${walOk ? 'OK' : 'FAIL'}] journal_mode = ${walMode}`);
if (!walOk) allPassed = false;

// Verify foreign_keys ON
const fkEnabled = (db.pragma('foreign_keys') as Array<{ foreign_keys: number }>)[0]?.foreign_keys;
const fkOk = fkEnabled === 1;
console.log(`  [${fkOk ? 'OK' : 'FAIL'}] foreign_keys = ${fkEnabled}`);
if (!fkOk) allPassed = false;

console.log(`\nSmoke test: ${allPassed ? 'PASSED' : 'FAILED'}`);
process.exit(allPassed ? 0 : 1);
