export interface CollectOptions {
  projectPaths?: string[];
  maxAge?: number; // days
  includeSubagents?: boolean;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] };

export interface SessionMessage {
  type:
    | 'user'
    | 'assistant'
    | 'progress'
    | 'queue-operation'
    | 'system'
    | 'file-history-snapshot';
  role?: string;
  content: string | ContentBlock[];
  timestamp: string;
  sessionId: string;
}

export interface RawSession {
  id: string;
  projectPath: string;
  sessionPath: string;
  startedAt: Date;
  messages: SessionMessage[];
}

export interface SessionSource {
  readonly id: string; // 'claude_code' | 'codex'
  readonly name: string;
  readonly instructionFileName: string; // 'CLAUDE.md' | 'AGENTS.md'
  collectSessions(options: CollectOptions): Promise<RawSession[]>;
  getInstructionFilePath(projectPath: string): string;
  isAvailable(): Promise<boolean>;
}
