import { Router, type IRouter } from 'express';
import { getDb, improvementQueries, ruleQueries } from '../db/index.js';

export const statsRouter: IRouter = Router();

statsRouter.get('/', (_req, res) => {
  const db = getDb();
  const improvements = improvementQueries.findImprovements(db);
  const rules = ruleQueries.findActiveRules(db);

  const byStatus: Record<string, number> = {};
  for (const imp of improvements) {
    byStatus[imp.status] = (byStatus[imp.status] ?? 0) + 1;
  }

  res.json({
    correctionRateByCategory: {},
    improvementsByStatus: byStatus,
    sessionsByDay: [],
    totalRules: rules.length,
  });
});

statsRouter.get('/effectiveness', (_req, res) => {
  const db = getDb();
  const rules = ruleQueries.findActiveRules(db);
  res.json(rules.map(r => ({
    id: r.id,
    content: r.content,
    effectivenessScore: r.effectiveness_score,
    sampleCount: r.effectiveness_sample_count,
  })));
});
