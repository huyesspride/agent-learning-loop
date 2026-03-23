import { Router, type IRouter } from 'express';
import { getDb, sessionQueries } from '../db/index.js';
import { mapSession } from '../utils/mappers.js';

export const sessionsRouter: IRouter = Router();

sessionsRouter.get('/', (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string ?? '100', 10);
  const items = sessionQueries.findAllSessions(db, limit);
  res.json({ items: items.map(mapSession), total: items.length });
});

sessionsRouter.get('/:id', (req, res) => {
  const db = getDb();
  const session = sessionQueries.findSessionByPath(db, req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(mapSession(session));
});
