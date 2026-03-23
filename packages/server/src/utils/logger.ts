// Simple structured logger
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: LogLevel, message: string, data?: unknown): void {
  if (levels[level] < levels[LOG_LEVEL]) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...(data ? { data } : {}),
  };
  const output = level === 'error' ? process.stderr : process.stdout;
  output.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
};
