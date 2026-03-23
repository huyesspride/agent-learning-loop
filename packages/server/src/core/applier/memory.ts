import { join } from 'path';
import { homedir } from 'os';
import { ClaudeMdTarget } from './claude-md.js';

// MemoryTarget writes to ~/.claude/CLAUDE.md (global Claude memory)
// Uses same format as ClaudeMdTarget
export class MemoryTarget extends ClaudeMdTarget {
  readonly type = 'memory';

  getDefaultPath(): string {
    return join(homedir(), '.claude', 'CLAUDE.md');
  }
}

export const memoryTarget = new MemoryTarget();
