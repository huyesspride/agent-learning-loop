import express, { type Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// General API rate limit: 100 requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

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

  // Rate limiting for API routes
  app.use('/api', apiLimiter);

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

  // Serve built web frontend (packages/web/dist)
  const webDist = join(__dirname, '..', '..', '..', 'packages', 'web', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback — serve index.html for all non-API routes
    app.get(/^(?!\/api|\/health).*$/, (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  } else {
    // 404 handler (no web dist)
    app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  // Global error handler
  app.use((err: Error & { status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status ?? err.statusCode ?? 500;
    logger.error('Request error', { message: err.message, status, stack: err.stack?.slice(0, 500) });
    res.status(status).json({
      error: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack?.slice(0, 200) } : {}),
    });
  });

  return app;
}
