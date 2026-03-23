import { Router, type IRouter } from 'express';
import { getDb, sessionQueries } from '../db/index.js';

export const sessionsRouter: IRouter = Router();

sessionsRouter.get('/', (_req, res) => {
  const db = getDb();
  // No list-all function available; return dashboard stats as summary
  const stats = sessionQueries.getDashboardStats(db);
  res.json(stats);
});

sessionsRouter.get('/:id', (req, res) => {
  const db = getDb();
  // findSessionByPath searches by session_path; use req.params.id as path
  const session = sessionQueries.findSessionByPath(db, req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});
