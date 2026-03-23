import express, { type Application } from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { dashboardRouter } from './routes/dashboard.js';
import { scanRouter } from './routes/scan.js';
import { improvementsRouter } from './routes/improvements.js';
import { applyRouter } from './routes/apply.js';
import { rulesRouter } from './routes/rules.js';
import { sessionsRouter } from './routes/sessions.js';
import { statsRouter } from './routes/stats.js';
import { optimizeRouter } from './routes/optimize.js';
import { configRouter } from './routes/config.js';
import { rollbackRouter } from './routes/rollback.js';

export function createApp(): Application {
  const app = express();

  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3939'],
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/scan', scanRouter);
  app.use('/api/improvements', improvementsRouter);
  app.use('/api/apply', applyRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/optimize', optimizeRouter);
  app.use('/api/config', configRouter);
  app.use('/api/rollback', rollbackRouter);

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}
