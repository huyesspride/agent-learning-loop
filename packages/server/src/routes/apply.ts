import { Router, type IRouter } from 'express';
import { getDb } from '../db/index.js';
import { Applier } from '../core/applier/index.js';

export const applyRouter: IRouter = Router();

applyRouter.post('/', async (req, res) => {
  const db = getDb();
  const { improvementIds } = req.body;

  if (!Array.isArray(improvementIds) || improvementIds.length === 0) {
    res.status(400).json({ error: 'improvementIds must be a non-empty array' });
    return;
  }

  const applier = new Applier(db);
  const result = await applier.apply(improvementIds);
  res.json(result);
});

applyRouter.post('/dry-run', async (req, res) => {
  const db = getDb();
  const { improvementIds } = req.body;

  if (!Array.isArray(improvementIds) || improvementIds.length === 0) {
    res.status(400).json({ error: 'improvementIds required' });
    return;
  }

  const applier = new Applier(db);
  const result = await applier.dryRun(improvementIds);
  res.json(result);
});
