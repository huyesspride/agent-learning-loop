import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface ClaudeRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ClaudeResponse {
  content: string;
  model?: string;
}

export class ClaudeClient {
  private readonly defaultTimeoutMs = 120_000; // 2 min
  private readonly defaultModel: string;

  constructor(model?: string) {
    this.defaultModel = model ?? 'claude-opus-4-5';
  }

  async call(request: ClaudeRequest): Promise<ClaudeResponse> {
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const model = request.model ?? this.defaultModel;

    return new Promise((resolve, reject) => {
      // Build args for claude CLI
      const args = [
        '--model', model,
        '--print',        // non-interactive mode
        '--no-markdown',  // plain text output
      ];
      if (request.systemPrompt) {
        args.push('--system', request.systemPrompt);
      }

      const proc = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Claude CLI timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          logger.error('Claude CLI error', { code, stderr: stderr.slice(0, 500) });
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 200)}`));
          return;
        }
        resolve({ content: stdout.trim(), model });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Claude CLI not found: ${err.message}. Install Claude Code CLI first.`));
      });

      // Write prompt to stdin
      proc.stdin.write(request.prompt);
      proc.stdin.end();
    });
  }
}

// Singleton instance
let _client: ClaudeClient | null = null;

export function getClaudeClient(model?: string): ClaudeClient {
  if (!_client) _client = new ClaudeClient(model);
  return _client;
}
