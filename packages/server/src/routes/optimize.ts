import { Router, type IRouter } from 'express';
import { getDb } from '../db/index.js';
import { createOptimizer } from '../core/optimizer/index.js';
import { SseStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';

export const optimizeRouter: IRouter = Router();

optimizeRouter.post('/', async (req, res) => {
  const db = getDb();
  const { maxRules, maxWords, dryRun } = req.body ?? {};

  const optimizer = createOptimizer(db);
  res.status(202).json({ message: 'Optimizer started', status: 'running' });

  optimizer.optimize({ maxRules, maxWords, dryRun }).catch(err => {
    logger.error('Optimizer failed', { error: String(err) });
  });
});

optimizeRouter.get('/status', (req, res) => {
  const sse = new SseStream(res);
  const db = getDb();
  const { maxRules, maxWords } = req.query;

  const optimizer = createOptimizer(db, sse);
  optimizer.optimize({
    maxRules: maxRules ? parseInt(maxRules as string) : undefined,
    maxWords: maxWords ? parseInt(maxWords as string) : undefined,
  }).catch(err => {
    logger.error('SSE optimizer failed', { error: String(err) });
  });
});
