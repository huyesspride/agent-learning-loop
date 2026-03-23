import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { SseStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';
import { claudeCodeSource } from './sources/claude-code.js';
import { heuristicDetector } from './detection/heuristic-detector.js';
import { claudeAnalyzer } from './analyzer/index.js';
import { sessionQueries, improvementQueries, ruleQueries, runQueries } from '../db/index.js';
import { getConfig } from '../config/index.js';
import type { CollectOptions } from '@cll/shared';

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
    private sse?: SseStream,
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

      // Filter out already-analyzed sessions
      const newSessions = allSessions.filter(session => {
        const existing = sessionQueries.findSessionByPath(this.db, session.sessionPath);
        return !existing || existing.status === 'pending';
      });

      this.sse?.send('progress', {
        phase: 'collect',
        total: newSessions.length,
        message: `Found ${newSessions.length} new sessions`,
      });

      // PHASE 2: HEURISTIC DETECT
      logger.info('Scan phase: detect');
      const withCorrections: typeof newSessions = [];
      const skipped: typeof newSessions = [];

      for (const session of newSessions) {
        // Insert session record
        sessionQueries.insertSession(this.db, {
          id: session.id,
          projectPath: session.projectPath,
          sessionPath: session.sessionPath,
          startedAt: session.startedAt.toISOString(),
          messageCount: session.messages.length,
          userMessageCount: session.messages.filter(m => m.type === 'user').length,
          status: 'pending',
        });

        const detection = heuristicDetector.detect(session.messages);

        if (detection.hasCorrections) {
          withCorrections.push(session);
          sessionQueries.updateSessionStatus(this.db, session.id, 'pending', {
            correctionCount: detection.correctionCount,
          });
        } else {
          skipped.push(session);
          sessionQueries.updateSessionStatus(this.db, session.id, 'skipped');
        }
      }

      this.sse?.send('progress', {
        phase: 'detect',
        withCorrections: withCorrections.length,
        skipped: skipped.length,
      });

      // PHASE 3: ANALYZE
      logger.info('Scan phase: analyze', { sessions: withCorrections.length });
      const batchSize = options.batchSize ?? config.claude.maxBatchSize;
      const maxBatches = options.maxBatches ?? config.claude.maxCallsPerScan;
      const existingRuleRows = ruleQueries.findActiveRules(this.db);
      const existingRules = existingRuleRows.map(r => ({ id: r.id, content: r.content }));
      const categories = config.analysis.categories;

      let totalImprovements = 0;
      const sessionsToAnalyze = withCorrections.slice(0, batchSize * maxBatches);
      const batches: typeof withCorrections[] = [];

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
          detectionResult: heuristicDetector.detect(session.messages),
          existingRules,
          categories,
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

        // Update session status
        for (const session of batch) {
          sessionQueries.updateSessionStatus(this.db, session.id, 'analyzed', {
            analyzedAt: new Date().toISOString(),
          });
        }
      }

      // PHASE 4: COMPLETE
      const stats = {
        collected: newSessions.length,
        withCorrections: withCorrections.length,
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
