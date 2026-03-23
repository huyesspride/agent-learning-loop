import { Router, type IRouter } from 'express';
import { randomUUID } from 'crypto';
import { getDb, ruleQueries } from '../db/index.js';
import { mapRule } from '../utils/mappers.js';

export const rulesRouter: IRouter = Router();

rulesRouter.get('/', (req, res) => {
  const db = getDb();
  const { category, target } = req.query;

  // findActiveRules only supports { category?, target? } — no status filter
  const rules = ruleQueries.findActiveRules(db, {
    category: category as string | undefined,
    target: target as string | undefined,
  });

  res.json({ items: rules.map(mapRule), total: rules.length });
});

rulesRouter.post('/', (req, res) => {
  const db = getDb();
  const { content, note, category, target = 'claude_md' } = req.body;

  if (!content) {
    res.status(400).json({ error: 'content required' });
    return;
  }

  const id = randomUUID();
  ruleQueries.insertRule(db, { id, content, note, category, target });
  res.status(201).json({ id });
});

rulesRouter.patch('/:id', (req, res) => {
  const db = getDb();
  ruleQueries.updateRule(db, req.params.id, req.body);
  const rule = ruleQueries.findRuleById(db, req.params.id);
  res.json(rule ? mapRule(rule) : null);
});

rulesRouter.delete('/:id', (req, res) => {
  const db = getDb();
  ruleQueries.deleteRule(db, req.params.id);
  res.json({ success: true });
});
