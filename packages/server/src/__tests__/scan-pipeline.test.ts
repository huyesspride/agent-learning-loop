import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../db/migrations.js';
import { ScanPipeline } from '../core/scanner.js';
import { sessionQueries, improvementQueries, runQueries } from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures', 'sessions');

// Mock the Claude client to avoid actual API calls
vi.mock('../claude/client.js', () => ({
  getClaudeClient: () => ({
    call: vi.fn().mockResolvedValue({
      content: JSON.stringify([
        {
          category: 'communication',
          severity: 'medium',
          whatHappened: 'Claude gave wrong answer',
          userCorrection: 'Sai rồi',
          suggestedRule: 'Verify factual claims before stating them',
          applyTo: 'claude_md',
        }
      ])
    })
  }),
  ClaudeClient: vi.fn(),
}));

// Mock the config to use test settings
vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    claude: { maxBatchSize: 5, maxCallsPerScan: 2, model: 'test' },
    scan: { maxSessionAge: 365, includeSubagents: false },
    analysis: {
      heuristicThreshold: 0.6,
      categories: ['code_quality', 'communication', 'tool_usage'],
    },
  }),
  loadConfig: () => ({
    claude: { maxBatchSize: 5, maxCallsPerScan: 2, model: 'test' },
    scan: { maxSessionAge: 365, includeSubagents: false },
    analysis: {
      heuristicThreshold: 0.6,
      categories: ['code_quality', 'communication', 'tool_usage'],
    },
  }),
}));

// Mock ClaudeCodeSource to return our fixtures instead of real ~/.claude files
vi.mock('../core/sources/claude-code.js', async (importOriginal) => {
  const { readFileSync } = await import('fs');
  const { join, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(__dirname, 'fixtures', 'sessions');

  // Parse fixture files
  const parseFixture = (filename: string) => {
    const content = readFileSync(join(fixturesDir, filename), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const messages = lines.map(l => {
      const entry = JSON.parse(l);
      const msg = entry.message ?? entry;
      return {
        type: entry.type,
        role: msg.role ?? entry.type,
        content: msg.content ?? '',
        timestamp: entry.timestamp ?? new Date().toISOString(),
        sessionId: entry.sessionId ?? 'test',
      };
    });
    return messages;
  };

  const original = await importOriginal<typeof import('../core/sources/claude-code.js')>();

  return {
    ...original,
    claudeCodeSource: {
      id: 'claude_code',
      name: 'Claude Code',
      instructionFileName: 'CLAUDE.md',
      isAvailable: async () => true,
      getInstructionFilePath: (p: string) => join(p, 'CLAUDE.md'),
      collectSessions: async () => [
        {
          id: 'test-simple-001',
          projectPath: '/test/project',
          sessionPath: join(fixturesDir, 'simple-session.jsonl'),
          startedAt: new Date(),
          messages: parseFixture('simple-session.jsonl'),
        },
        {
          id: 'test-correction-002',
          projectPath: '/test/project',
          sessionPath: join(fixturesDir, 'correction-session.jsonl'),
          startedAt: new Date(),
          messages: parseFixture('correction-session.jsonl'),
        },
        {
          id: 'test-english-003',
          projectPath: '/test/project',
          sessionPath: join(fixturesDir, 'english-correction-session.jsonl'),
          startedAt: new Date(),
          messages: parseFixture('english-correction-session.jsonl'),
        },
      ],
    },
  };
});

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

describe('ScanPipeline', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('should collect 3 sessions from fixtures', async () => {
    const pipeline = new ScanPipeline(db);
    const result = await pipeline.run();
    expect(result.collected).toBe(3);
  });

  it('should detect corrections in 2 of 3 sessions', async () => {
    const pipeline = new ScanPipeline(db);
    const result = await pipeline.run();
    // simple-session has no corrections
    // correction-session and english-correction-session have corrections
    expect(result.withCorrections).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it('should mark skipped sessions in DB', async () => {
    const pipeline = new ScanPipeline(db);
    await pipeline.run();

    // Verify sessions exist in DB
    const stats = sessionQueries.getDashboardStats(db);
    expect(stats.totalSessions).toBe(3);
  });

  it('should store improvements from analyzer', async () => {
    const pipeline = new ScanPipeline(db);
    const result = await pipeline.run();

    expect(result.improvements).toBeGreaterThan(0);

    const improvements = improvementQueries.findImprovements(db);
    expect(improvements.length).toBeGreaterThan(0);
    expect(improvements[0].status).toBe('pending');
    expect(improvements[0].category).toBe('communication');
  });

  it('should record run in DB', async () => {
    const pipeline = new ScanPipeline(db);
    await pipeline.run();

    const runs = runQueries.getRecentRuns(db, 1);
    expect(runs.length).toBe(1);
    expect(runs[0].run_type).toBe('scan');
    expect(runs[0].status).toBe('completed');
  });

  it('should emit SSE events in correct order', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const mockSse = {
      send: (event: string, data: unknown) => events.push({ event, data }),
      close: () => {},
    } as any;

    const pipeline = new ScanPipeline(db, mockSse);
    await pipeline.run();

    const phases = events.map(e => (e.data as any).phase);
    expect(phases).toContain('collect');
    expect(phases).toContain('detect');
    expect(phases).toContain('analyze');
    expect(phases).toContain('complete');

    // Phases should be in order
    const collectIdx = phases.indexOf('collect');
    const detectIdx = phases.indexOf('detect');
    const completeIdx = phases.lastIndexOf('complete');
    expect(collectIdx).toBeLessThan(detectIdx);
    expect(detectIdx).toBeLessThan(completeIdx);
  });

  it('should not re-analyze already-analyzed sessions', async () => {
    const pipeline = new ScanPipeline(db);

    // Run twice
    const result1 = await pipeline.run();
    const result2 = await pipeline.run();

    // Second run should find 0 new sessions (all already in DB)
    expect(result2.collected).toBe(0);
  });
});
