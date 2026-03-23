import { Router, type IRouter } from 'express';
import { getDb, improvementQueries } from '../db/index.js';
import { mapImprovement } from '../utils/mappers.js';

export const improvementsRouter: IRouter = Router();

improvementsRouter.get('/', (req, res) => {
  const db = getDb();
  const { status, category, severity } = req.query;

  const items = improvementQueries.findImprovements(db, {
    status: status as string | undefined,
    category: category as string | undefined,
    severity: severity as string | undefined,
  });

  res.json({ items: items.map(mapImprovement), total: items.length });
});

improvementsRouter.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status, editedRule, note } = req.body;

  // Allow note-only update without changing status
  if (status !== undefined && !['approved', 'edited', 'skipped', 'pending'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const currentStatus = status ?? improvementQueries.findImprovementById(db, id)?.status ?? 'pending';

  improvementQueries.updateImprovementStatus(db, id, currentStatus, {
    editedRule,
    note,
    reviewedAt: status ? new Date().toISOString() : undefined,
  });

  const updated = improvementQueries.findImprovementById(db, id);
  res.json(updated ? mapImprovement(updated) : null);
});
