import express, { type Application } from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';

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

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}
