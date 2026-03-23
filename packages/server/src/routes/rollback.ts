import { Router, type IRouter } from 'express';
import { getDb } from '../db/index.js';
import { BackupManager } from '../core/applier/index.js';

export const rollbackRouter: IRouter = Router();

rollbackRouter.get('/snapshots', (_req, res) => {
  const db = getDb();
  const manager = new BackupManager(db);
  const backups = manager.listBackups();
  res.json({ items: backups });
});

rollbackRouter.post('/', (req, res) => {
  const db = getDb();
  const { backupId } = req.body;

  if (backupId === undefined || backupId === null) {
    res.status(400).json({ error: 'backupId required' });
    return;
  }

  const id = Number(backupId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'backupId must be a positive integer' });
    return;
  }

  const manager = new BackupManager(db);
  manager.restore(id);
  res.json({ success: true, backupId: id });
});
