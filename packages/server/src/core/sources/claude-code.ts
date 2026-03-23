import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { SessionSource, CollectOptions, RawSession, SessionMessage, ContentBlock } from '@cll/shared';

// Claude Code session storage location
const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

export class ClaudeCodeSource implements SessionSource {
  readonly id = 'claude_code';
  readonly name = 'Claude Code';
  readonly instructionFileName = 'CLAUDE.md';

  async isAvailable(): Promise<boolean> {
    return existsSync(CLAUDE_DIR);
  }

  getInstructionFilePath(projectPath: string): string {
    return join(projectPath, 'CLAUDE.md');
  }

  async collectSessions(options: CollectOptions = {}): Promise<RawSession[]> {
    if (!existsSync(PROJECTS_DIR)) return [];

    const { projectPaths, maxAge = 30, includeSubagents = false } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const sessions: RawSession[] = [];

    // Each subdirectory in ~/.claude/projects/ is an encoded project path
    let projectDirs: string[];
    try {
      projectDirs = readdirSync(PROJECTS_DIR);
    } catch {
      return [];
    }

    for (const encodedPath of projectDirs) {
      const projectDir = join(PROJECTS_DIR, encodedPath);

      // Read .jsonl files in this project dir first to discover actual projectPath from cwd field
      let files: string[];
      try {
        files = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      } catch {
        continue;
      }

      for (const file of files) {
        // Skip subagent files if not requested
        if (!includeSubagents && file.includes('subagent')) continue;

        const sessionPath = join(projectDir, file);

        try {
          const stat = statSync(sessionPath);

          // Filter by age
          if (stat.mtime < cutoffDate) continue;

          const session = parseSessionFile(sessionPath);
          if (!session) continue;

          // Filter by projectPaths if specified (use actual cwd-derived projectPath)
          if (projectPaths && projectPaths.length > 0) {
            const matches = projectPaths.some(
              p => session.projectPath === p || session.projectPath.startsWith(p),
            );
            if (!matches) continue;
          }

          sessions.push(session);
        } catch {
          // Skip files we can't read
          continue;
        }
      }
    }

    return sessions;
  }
}

/**
 * Decode a Claude Code encoded project path to a filesystem path.
 *
 * Observed encoding rules (from ~/.claude/projects/ inspection):
 *   - Leading `/` → leading `-`
 *   - `/` path separator → `-`
 *   - `/.` (hidden dir prefix) → `--`
 *
 * Examples verified against actual filesystem:
 *   `-Users-vanhuy-Desktop-esspride-agent-learning-loop`
 *     → `/Users/vanhuy/Desktop/esspride/agent-learning-loop`
 *   `-Users-vanhuy-Desktop-esspride-hmvmobagacha-v2--claude-worktrees-hardcore-knuth`
 *     → `/Users/vanhuy/Desktop/esspride/hmvmobagacha-v2/.claude/worktrees/hardcore-knuth`
 *
 * Note: This decoding is lossy because dashes inside directory names are
 * indistinguishable from path separators. For reliable projectPath extraction,
 * prefer reading the `cwd` field from JSONL entries (see parseSessionFile).
 */
export function decodeProjectPath(encoded: string): string {
  // Replace double-dash (hidden dir separator) with a placeholder first
  // so single dashes can be handled independently
  const HIDDEN_DIR_PLACEHOLDER = '\x00';
  let result = encoded.replace(/--/g, HIDDEN_DIR_PLACEHOLDER);
  // Replace leading dash with forward slash (leading /)
  result = result.replace(/^-/, '/');
  // Replace remaining single dashes with forward slashes
  result = result.replace(/-/g, '/');
  // Restore hidden dir placeholders as /. (e.g. /.claude)
  result = result.replace(/\x00/g, '/.');
  return result;
}

export function parseSessionFile(sessionPath: string): RawSession | null {
  const content = readFileSync(sessionPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) return null;

  const messages: SessionMessage[] = [];
  let sessionId = basename(sessionPath, '.jsonl');
  let startedAt = new Date();
  let foundFirst = false;
  // projectPath is extracted from the cwd field in JSONL entries (reliable, not lossy)
  let projectPath = '';

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;

      if (!foundFirst) {
        sessionId = (entry.sessionId as string) ?? sessionId;
        if (entry.timestamp) startedAt = new Date(entry.timestamp as string);
        foundFirst = true;
      }

      // Extract the actual project path from cwd (available on most entries)
      if (!projectPath && typeof entry.cwd === 'string' && entry.cwd) {
        projectPath = entry.cwd;
      }

      const msg = parseMessage(entry);
      if (msg) messages.push(msg);
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  if (messages.length === 0) return null;

  return {
    id: sessionId,
    projectPath,
    sessionPath,
    startedAt,
    messages,
  };
}

function parseMessage(entry: Record<string, unknown>): SessionMessage | null {
  const type = entry.type as string;
  if (!type) return null;

  // Only care about user/assistant messages for analysis
  const validTypes = ['user', 'assistant', 'progress', 'queue-operation', 'system', 'file-history-snapshot'];
  if (!validTypes.includes(type)) return null;

  const message = entry.message as Record<string, unknown> | undefined;
  const content = message?.content ?? entry.content;

  return {
    type: type as SessionMessage['type'],
    role: (message?.role as string) ?? type,
    content: parseContent(content),
    timestamp: (entry.timestamp as string) ?? new Date().toISOString(),
    sessionId: (entry.sessionId as string) ?? '',
  };
}

function parseContent(content: unknown): string | ContentBlock[] {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(block => parseContentBlock(block)).filter(Boolean) as ContentBlock[];
  }
  return '';
}

function parseContentBlock(block: unknown): ContentBlock | null {
  if (typeof block !== 'object' || block === null) return null;
  const b = block as Record<string, unknown>;

  switch (b.type) {
    case 'text':
      return { type: 'text', text: String(b.text ?? '') };
    case 'thinking':
      return { type: 'thinking', thinking: String(b.thinking ?? '') };
    case 'tool_use':
      return { type: 'tool_use', id: String(b.id ?? ''), name: String(b.name ?? ''), input: b.input };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: String(b.tool_use_id ?? ''),
        content: parseContent(b.content),
      };
    default:
      return null;
  }
}

export function extractText(message: SessionMessage): string {
  const { content } = message;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (block.type === 'text') return block.text;
        if (block.type === 'thinking') return block.thinking;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

// Singleton
export const claudeCodeSource = new ClaudeCodeSource();
