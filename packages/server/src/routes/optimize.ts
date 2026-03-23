import { Router, type IRouter } from 'express';

export const optimizeRouter: IRouter = Router();

optimizeRouter.post('/', (_req, res) => {
  res.status(501).json({ message: 'Optimizer coming in Phase 3' });
});

optimizeRouter.get('/status', (_req, res) => {
  res.status(501).json({ message: 'Optimizer status coming in Phase 3' });
});
