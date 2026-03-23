import type { AppConfig } from '@cll/shared';

export const DEFAULT_CONFIG: AppConfig = {
  port: 3939,
  dbPath: '~/.cll/cll.db',
  claude: {
    model: 'claude-opus-4-5',
    maxBatchSize: 5,
    maxCallsPerScan: 5,
  },
  scan: {
    includeSubagents: false,
    maxSessionAge: 30,
    autoScanInterval: 0,
  },
  analysis: {
    heuristicThreshold: 0.6,
    mergeOnApply: true,
    categories: [
      'code_quality',
      'tool_usage',
      'factual_accuracy',
      'communication',
      'workflow',
    ],
  },
  privacy: {
    redactEmails: true,
    redactApiKeys: true,
    redactPaths: false,
  },
};
