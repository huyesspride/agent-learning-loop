import { randomUUID } from 'crypto';
import { statSync } from 'fs';
import type Database from 'better-sqlite3';
import type { ISseStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';
import { claudeCodeSource } from './sources/claude-code.js';
import { claudeAnalyzer } from './analyzer/index.js';
import { sessionQueries, improvementQueries, ruleQueries, runQueries } from '../db/index.js';
import { getConfig } from '../config/index.js';
import type { CollectOptions, RawSession } from '@cll/shared';

export interface ScanOptions extends CollectOptions {
  maxBatches?: number;
  batchSize?: number;
}

export interface ScanResult {
  runId: number;
  collected: number;
  withCorrections: number;
  skipped: number;
  improvements: number;
}

export class ScanPipeline {
  constructor(
    private db: Database.Database,
    private sse?: ISseStream,
  ) {}

  async run(options: ScanOptions = {}): Promise<ScanResult> {
    const config = getConfig();
    const runId = runQueries.startRun(this.db, 'scan');

    try {
      // PHASE 1: COLLECT
      logger.info('Scan phase: collect');
      const allSessions = await claudeCodeSource.collectSessions({
        projectPaths: options.projectPaths,
        maxAge: options.maxAge ?? config.scan.maxSessionAge,
        includeSubagents: options.includeSubagents ?? config.scan.includeSubagents,
      });

      // Pre-load all known sessions to avoid N+1 DB queries during filter
      const knownSessions = sessionQueries.findAllSessionsByPath(this.db);
      const alreadyInDb = new Set<string>();
      const sessionMessageOffset = new Map<string, number>(); // sessionPath → already-analyzed msg count

      const newSessions = allSessions.filter(session => {
        const existing = knownSessions.get(session.sessionPath);
        if (!existing) return true; // brand new session

        alreadyInDb.add(session.sessionPath);

        if (existing.status === 'pending') return true; // stuck, retry all

        if (existing.status === 'analyzed' && existing.analyzed_at) {
          // Check if file was modified after last analysis (resumed session)
          try {
            const mtime = statSync(session.sessionPath).mtime;
            if (mtime > new Date(existing.analyzed_at)) {
              // Only analyze the new tail (messages added since last scan)
              sessionMessageOffset.set(session.sessionPath, existing.message_count ?? 0);
              return true;
            }
          } catch { /* file unreadable, skip */ }
        }

        return false; // analyzed and not modified → skip
      });

      this.sse?.send('progress', {
        phase: 'collect',
        total: newSessions.length,
        message: `Found ${newSessions.length} new sessions`,
      });

      // PHASE 2: FILTER — only sessions with enough user interaction (min 3 user messages)
      logger.info('Scan phase: detect');
      const toAnalyze: typeof newSessions = [];
      const skipped: typeof newSessions = [];

      for (const session of newSessions) {
        const userMsgCount = session.messages.filter(m => m.type === 'user').length;

        // Only insert if not already in DB (avoid UNIQUE constraint on session_path)
        if (!alreadyInDb.has(session.sessionPath)) {
          sessionQueries.insertSession(this.db, {
            id: session.id,
            projectPath: session.projectPath,
            sessionPath: session.sessionPath,
            startedAt: session.startedAt.toISOString(),
            messageCount: session.messages.length,
            userMessageCount: userMsgCount,
            status: 'pending',
          });
        }

        if (userMsgCount >= 3) {
          toAnalyze.push(session);
        } else {
          skipped.push(session);
          sessionQueries.updateSessionStatus(this.db, session.id, 'skipped');
        }
      }

      this.sse?.send('progress', {
        phase: 'detect',
        withCorrections: toAnalyze.length,
        skipped: skipped.length,
      });

      // PHASE 3: DEEP ANALYZE — full session narrative, no heuristic gate
      logger.info('Scan phase: analyze', { sessions: toAnalyze.length });
      const batchSize = options.batchSize ?? config.claude.maxBatchSize;
      const maxBatches = options.maxBatches ?? config.claude.maxCallsPerScan;
      const existingRuleRows = ruleQueries.findActiveRules(this.db);
      const existingRules = existingRuleRows.map(r => ({ id: r.id, content: r.content }));
      const categories = config.analysis.categories;

      let totalImprovements = 0;
      const sessionsToAnalyze = toAnalyze.slice(0, maxBatches);
      const batches: typeof toAnalyze[] = [];

      for (let i = 0; i < sessionsToAnalyze.length; i += batchSize) {
        batches.push(sessionsToAnalyze.slice(i, i + batchSize));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        this.sse?.send('progress', {
          phase: 'analyze',
          batch: `${batchIdx + 1}/${batches.length}`,
        });

        const analyzerInputs = batch.map(session => ({
          session,
          existingRules,
          categories,
          messageOffset: sessionMessageOffset.get(session.sessionPath) ?? 0,
        }));

        const improvements = await claudeAnalyzer.analyzeBatch(analyzerInputs);

        for (const imp of improvements) {
          const improvementId = randomUUID();
          // conflictWith is string[] | undefined — join to comma-separated string for DB
          const conflictWithStr = imp.conflictWith && imp.conflictWith.length > 0
            ? imp.conflictWith.join(',')
            : undefined;

          improvementQueries.insertImprovement(this.db, {
            id: improvementId,
            sessionId: batch[0]?.id ?? '',
            category: imp.category,
            severity: imp.severity,
            whatHappened: imp.whatHappened,
            userCorrection: imp.userCorrection,
            suggestedRule: imp.suggestedRule,
            applyTo: imp.applyTo ?? 'claude_md',
            conflictWith: conflictWithStr,
          });
          totalImprovements++;
        }

        // Update session status + message count (for resumed session tracking)
        for (const session of batch) {
          sessionQueries.updateSessionStatus(this.db, session.id, 'analyzed', {
            analyzedAt: new Date().toISOString(),
            messageCount: session.messages.length,
            userMessageCount: session.messages.filter(m => m.type === 'user').length,
          });
        }
      }

      // PHASE 4: COMPLETE
      const stats = {
        collected: newSessions.length,
        withCorrections: toAnalyze.length,
        skipped: skipped.length,
        improvements: totalImprovements,
      };

      runQueries.completeRun(this.db, runId, 'completed', stats);

      this.sse?.send('progress', {
        phase: 'complete',
        improvements: totalImprovements,
        runId,
      });

      this.sse?.close();

      logger.info('Scan complete', stats);
      return { runId, ...stats };

    } catch (err) {
      runQueries.failRun(this.db, runId, String(err));
      this.sse?.send('progress', { phase: 'error', error: String(err) });
      this.sse?.close();
      throw err;
    }
  }
}
