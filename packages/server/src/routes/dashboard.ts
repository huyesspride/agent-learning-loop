import { Router, type IRouter } from 'express';
import { getDb, sessionQueries, improvementQueries, ruleQueries, runQueries } from '../db/index.js';

export const dashboardRouter: IRouter = Router();

dashboardRouter.get('/', (_req, res) => {
  const db = getDb();

  const sessionStats = sessionQueries.getDashboardStats(db);
  const pendingImprovements = improvementQueries.countPendingImprovements(db);
  const activeRules = ruleQueries.findActiveRules(db).length;
  const recentRuns = runQueries.getRecentRuns(db, 5);

  // Map snake_case RunRow → camelCase RunSummary for frontend
  const mappedRuns = recentRuns.map(r => ({
    id: r.id,
    runType: r.run_type,
    startedAt: r.started_at ? r.started_at.replace(' ', 'T') + 'Z' : null,
    completedAt: r.completed_at ? r.completed_at.replace(' ', 'T') + 'Z' : undefined,
    status: r.status,
    stats: r.stats ? JSON.parse(r.stats) : undefined,
  }));

  res.json({
    ...sessionStats,
    totalImprovements: pendingImprovements,
    pendingImprovements,
    appliedRules: activeRules,
    correctionRate: 0,
    recentRuns: mappedRuns,
    correctionTrend: [],
  });
});
