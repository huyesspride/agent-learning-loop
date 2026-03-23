export interface AppConfig {
  port: number;
  dbPath: string;
  claude: {
    model: string;
    maxBatchSize: number;
    maxCallsPerScan: number;
    apiKey?: string;
  };
  scan: {
    includeSubagents: boolean;
    maxSessionAge: number; // days
    autoScanInterval: number; // minutes, 0 = disabled
  };
  analysis: {
    heuristicThreshold: number;
    categories: string[];
    mergeOnApply: boolean; // run Claude merge pass before writing to CLAUDE.md
  };
  privacy: {
    redactEmails: boolean;
    redactApiKeys: boolean;
    redactPaths: boolean;
  };
}
