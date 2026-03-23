import { Router, type IRouter } from 'express';
import { getDb } from '../db/index.js';
import { ScanPipeline } from '../core/scanner.js';
import { SseStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';

export const scanRouter: IRouter = Router();

scanRouter.post('/', async (req, res) => {
  const { projectPaths, options } = req.body ?? {};
  const db = getDb();

  const pipeline = new ScanPipeline(db);

  res.status(202).json({ message: 'Scan started', status: 'running' });

  pipeline.run({ projectPaths, ...options }).catch(err => {
    logger.error('Scan failed', { error: String(err) });
  });
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
