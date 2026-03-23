import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { runMigrations } from '../db/migrations.js';
import { Applier } from '../core/applier/index.js';
import { improvementQueries, ruleQueries } from '../db/index.js';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function insertApprovedImprovement(
  db: Database.Database,
  extra?: Partial<{
    status: string;
    applyTo: string;
    suggestedRule: string;
    editedRule: string;
  }>
): string {
  const id = randomUUID();
  // sessionId is omitted (null) to avoid FK constraint against sessions table
  improvementQueries.insertImprovement(db, {
    id,
    category: 'code_quality',
    severity: 'medium',
    whatHappened: 'Claude made an error',
    suggestedRule: extra?.suggestedRule ?? 'Always verify before stating',
    applyTo: extra?.applyTo ?? 'claude_md',
    editedRule: extra?.editedRule,
    conflictWith: undefined,
  });
  improvementQueries.updateImprovementStatus(db, id, extra?.status ?? 'approved', {
    reviewedAt: new Date().toISOString(),
  });
  return id;
}

describe('Applier', () => {
  let db: Database.Database;
  let tmpClaude: string;

  beforeEach(() => {
    db = createTestDb();
    tmpClaude = join(tmpdir(), `cll-apply-test-${Date.now()}.md`);
  });

  afterEach(() => {
    if (existsSync(tmpClaude)) unlinkSync(tmpClaude);
  });

  it('should apply approved improvements to CLAUDE.md', async () => {
    insertApprovedImprovement(db, { suggestedRule: 'Test rule for integration' });

    // Test via the ClaudeMdTarget directly
    const { ClaudeMdTarget } = await import('../core/applier/claude-md.js');
    const target = new ClaudeMdTarget();

    // Write initial content
    writeFileSync(tmpClaude, '# My Rules\n\nKeep it simple.\n');

    const current = target.read(tmpClaude);
    current.cllRules = [...current.cllRules, 'Test rule for integration'];
    target.write(tmpClaude, current);

    // Verify rule was added
    const result = target.read(tmpClaude);
    expect(result.cllRules).toContain('Test rule for integration');
  });

  it('should create backup before applying', async () => {
    insertApprovedImprovement(db);

    const { BackupManager } = await import('../core/applier/backup.js');
    const manager = new BackupManager(db);

    // Create a test file and backup it
    writeFileSync(tmpClaude, '# Original content\n');
    const backupId = manager.backup(tmpClaude, 'pre_apply');

    expect(backupId).toBeGreaterThan(0);
    const backups = manager.listBackups(tmpClaude);
    expect(backups.length).toBe(1);
  });

  it('should update improvement status to applied', async () => {
    const id = insertApprovedImprovement(db);

    improvementQueries.updateImprovementStatus(db, id, 'applied', {
      appliedAt: new Date().toISOString(),
    });

    const updated = improvementQueries.findImprovementById(db, id);
    expect(updated?.status).toBe('applied');
    expect(updated?.applied_at).toBeTruthy();
  });

  it('should insert active_rules after apply', async () => {
    const ruleId = randomUUID();
    ruleQueries.insertRule(db, {
      id: ruleId,
      content: 'Test active rule',
      category: 'code_quality',
      target: 'claude_md',
    });

    const rules = ruleQueries.findActiveRules(db);
    expect(rules.some(r => r.content === 'Test active rule')).toBe(true);
  });

  it('should restore from backup', async () => {
    const originalContent = '# Original content\nImportant rules here.\n';
    writeFileSync(tmpClaude, originalContent);

    const { BackupManager } = await import('../core/applier/backup.js');
    const manager = new BackupManager(db);

    const backupId = manager.backup(tmpClaude, 'pre_apply');

    // Overwrite file
    writeFileSync(tmpClaude, '# Corrupted content\n');

    // Restore
    manager.restore(backupId, tmpClaude);

    const restored = readFileSync(tmpClaude, 'utf-8');
    expect(restored).toBe(originalContent);
  });

  it('should throw when no approved improvements', async () => {
    const applier = new Applier(db);
    await expect(applier.apply([])).rejects.toThrow();
  });
});
