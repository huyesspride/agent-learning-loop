import { Router, type IRouter } from 'express';
import { getDb, improvementQueries } from '../db/index.js';

export const improvementsRouter: IRouter = Router();

improvementsRouter.get('/', (req, res) => {
  const db = getDb();
  const { status, category, severity } = req.query;

  const items = improvementQueries.findImprovements(db, {
    status: status as string | undefined,
    category: category as string | undefined,
    severity: severity as string | undefined,
  });

  res.json({ items, total: items.length });
});

improvementsRouter.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status, editedRule } = req.body;

  if (!['approved', 'edited', 'skipped'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  improvementQueries.updateImprovementStatus(db, id, status, {
    editedRule,
    reviewedAt: new Date().toISOString(),
  });

  const updated = improvementQueries.findImprovementById(db, id);
  res.json(updated);
});
