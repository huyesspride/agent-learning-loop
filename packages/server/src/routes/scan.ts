import { Router, type IRouter } from 'express';
import { getDb } from '../db/index.js';
import { ScanPipeline } from '../core/scanner.js';
import { SseStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';

export const scanRouter: IRouter = Router();

let scanRunning = false;

scanRouter.post('/', async (req, res) => {
  if (scanRunning) {
    return res.status(409).json({ error: 'A scan is already running' });
  }

  const { projectPaths, options } = req.body ?? {};
  const db = getDb();

  const pipeline = new ScanPipeline(db);

  scanRunning = true;
  res.status(202).json({ message: 'Scan started', status: 'running' });

  const scanPromise = pipeline.run({ projectPaths, ...options });

  scanPromise
    .finally(() => { scanRunning = false; })
    .catch(err => { logger.error('Scan failed', { error: String(err) }); });
});

scanRouter.get('/status', (req, res) => {
  const sse = new SseStream(res);
  const db = getDb();
  const pipeline = new ScanPipeline(db, sse);

  const { projectPaths } = req.query;
  const paths = projectPaths ? [projectPaths as string] : undefined;

  pipeline.run({ projectPaths: paths }).catch(err => {
    logger.error('SSE scan failed', { error: String(err) });
  });
});
