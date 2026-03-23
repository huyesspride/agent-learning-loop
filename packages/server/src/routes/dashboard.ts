import { Router, type IRouter } from 'express';
import { getDb, sessionQueries, improvementQueries, ruleQueries, runQueries } from '../db/index.js';

export const dashboardRouter: IRouter = Router();

dashboardRouter.get('/', (_req, res) => {
  const db = getDb();

  const sessionStats = sessionQueries.getDashboardStats(db);
  const pendingImprovements = improvementQueries.countPendingImprovements(db);
  const activeRules = ruleQueries.findActiveRules(db).length;
  const recentRuns = runQueries.getRecentRuns(db, 5);

  res.json({
    ...sessionStats,
    pendingImprovements,
    appliedRules: activeRules,
    correctionRate: 0,
    recentRuns,
    correctionTrend: [],
  });
});
