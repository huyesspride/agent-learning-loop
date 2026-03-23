import { homedir } from 'os';
import { join } from 'path';

export const CLAUDE_MD_PATH = join(homedir(), '.claude', 'CLAUDE.md');
