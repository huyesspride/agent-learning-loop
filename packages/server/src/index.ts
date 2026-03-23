import { createApp } from './app.js';
import { getConfig, loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';

// Prevent unhandled errors (e.g. EPIPE from Claude CLI subprocess) from crashing the server
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return; // Ignore broken pipe errors
  logger.error('Uncaught exception', { message: err.message, code: err.code });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

async function main() {
  const config = loadConfig();
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`CLL server running`, { port: config.port });
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
