import { Router, type IRouter } from 'express';
import { EventEmitter } from 'events';
import { getDb } from '../db/index.js';
import { ScanPipeline } from '../core/scanner.js';
import { SseStream, type ISseStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';

export const scanRouter: IRouter = Router();

// Module-level state shared between POST and GET/status
const scanEmitter = new EventEmitter();
scanEmitter.setMaxListeners(50);
let scanRunning = false;
// Store the final event so late SSE connections can still receive scan completion
let lastScanFinalEvent: { event: string; data: unknown } | null = null;

/** NullSseStream: routes scan progress to scanEmitter (no HTTP streaming) */
class NullSseStream implements ISseStream {
  private _closed = false;

  send(event: string, data: unknown): void {
    if (this._closed) return;
    const payload = { event, data };
    // Save final event for late SSE subscribers
    const phase = (data as Record<string, unknown>)?.phase;
    if (phase === 'complete' || phase === 'error') {
      lastScanFinalEvent = payload;
    }
    scanEmitter.emit('progress', event, data);
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    scanEmitter.emit('done');
  }
}

scanRouter.post('/', async (req, res) => {
  if (scanRunning) {
    return res.status(409).json({ error: 'A scan is already running' });
  }

  const { projectPaths, options } = req.body ?? {};
  const db = getDb();

  const pipeline = new ScanPipeline(db, new NullSseStream());

  scanRunning = true;
  lastScanFinalEvent = null;
  res.status(202).json({ message: 'Scan started', status: 'running' });

  pipeline.run({ projectPaths, ...options })
    .finally(() => { scanRunning = false; })
    .catch(err => { logger.error('Scan failed', { error: String(err) }); });
});

// Quick status check — no SSE needed
scanRouter.get('/running', (_req, res) => {
  res.json({ running: scanRunning });
});

// SSE endpoint — subscribes to running scan events, or sends last result if already done
scanRouter.get('/status', (req, res) => {
  const sse = new SseStream(res);

  if (!scanRunning) {
    // If scan already completed, send the final event to the late subscriber
    if (lastScanFinalEvent) {
      sse.send(lastScanFinalEvent.event, lastScanFinalEvent.data);
    } else {
      sse.send('progress', { phase: 'idle', message: 'No scan running' });
    }
    sse.close();
    return;
  }

  // Forward events to this SSE client
  const onProgress = (event: string, data: unknown) => sse.send(event, data);
  const onDone = () => {
    scanEmitter.off('progress', onProgress);
    scanEmitter.off('done', onDone);
    sse.close();
  };

  scanEmitter.on('progress', onProgress);
  scanEmitter.on('done', onDone);

  req.on('close', () => {
    scanEmitter.off('progress', onProgress);
    scanEmitter.off('done', onDone);
  });
});
