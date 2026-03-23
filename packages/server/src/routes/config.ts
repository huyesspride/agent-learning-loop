import { Router, type IRouter } from 'express';
import { getConfig } from '../config/index.js';

export const configRouter: IRouter = Router();

configRouter.get('/', (_req, res) => {
  const config = getConfig();
  // Omit apiKey from response
  const { apiKey: _apiKey, ...claudeSafe } = config.claude;
  res.json({
    port: config.port,
    dbPath: config.dbPath,
    claude: claudeSafe,
    scan: config.scan,
    analysis: config.analysis,
    privacy: config.privacy,
  });
});

configRouter.patch('/', (_req, res) => {
  res.status(501).json({ message: 'Config update coming in Phase 3' });
});
