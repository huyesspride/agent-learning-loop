import { Router, type IRouter } from 'express';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { getDb, ruleQueries } from '../db/index.js';
import { mapRule } from '../utils/mappers.js';
import { CLAUDE_MD_PATH } from '../utils/paths.js';
import { extractManualRules } from '../core/applier/claude-md.js';

export const rulesRouter: IRouter = Router();

rulesRouter.get('/', (req, res) => {
  const db = getDb();
  const { category, target } = req.query;

  // findActiveRules only supports { category?, target? } — no status filter
  const dbRules = ruleQueries.findActiveRules(db, {
    category: category as string | undefined,
    target: target as string | undefined,
  });

  const cllItems = dbRules.map(r => ({ ...mapRule(r), source: 'cll' as const }));

  // Manual rules from the user-written sections of ~/.claude/CLAUDE.md
  let manualItems: object[] = [];
  if (existsSync(CLAUDE_MD_PATH)) {
    const raw = readFileSync(CLAUDE_MD_PATH, 'utf-8');
    manualItems = extractManualRules(raw).map(r => ({
      id: r.syntheticId,
      content: r.content,
      category: r.section,
      target: 'claude_md',
      source: 'manual',
      status: 'active',
      effectivenessScore: null,
      effectivenessSampleCount: 0,
      addedAt: null,
      note: null,
    }));
  }

  const allItems = [...manualItems, ...cllItems];
  res.json({ items: allItems, total: allItems.length });
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
