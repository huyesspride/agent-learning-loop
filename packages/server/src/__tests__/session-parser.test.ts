import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { parseSessionFile, extractText } from '../core/sources/claude-code.js';
import type { SessionMessage } from '@cll/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures', 'sessions');

describe('ClaudeCodeSource — Session Parser', () => {
  describe('parseSessionFile', () => {
    it('should parse simple session without corrections', () => {
      const sessionPath = join(fixturesDir, 'simple-session.jsonl');
      const session = parseSessionFile(sessionPath);

      expect(session).not.toBeNull();
      expect(session!.id).toBe('test-001');
      // 3 lines: user, assistant, user — all valid types
      expect(session!.messages.length).toBe(3);
      expect(session!.messages[0].type).toBe('user');
      expect(session!.messages[1].type).toBe('assistant');
      expect(session!.messages[2].type).toBe('user');
    });

    it('should parse session with string content', () => {
      const sessionPath = join(fixturesDir, 'simple-session.jsonl');
      const session = parseSessionFile(sessionPath);

      expect(session).not.toBeNull();
      const firstMsg = session!.messages[0];
      expect(typeof firstMsg.content).toBe('string');
      expect(firstMsg.content).toBe('Viết function tính tổng hai số');
    });

    it('should parse session with array content (ContentBlock[])', () => {
      const sessionPath = join(fixturesDir, 'english-correction-session.jsonl');
      const session = parseSessionFile(sessionPath);

      expect(session).not.toBeNull();
      // second message is assistant with array content
      const assistantMsg = session!.messages[1];
      expect(assistantMsg.type).toBe('assistant');
      expect(Array.isArray(assistantMsg.content)).toBe(true);
      const blocks = assistantMsg.content as Array<{ type: string; text?: string }>;
      expect(blocks[0].type).toBe('text');
      expect(blocks[0].text).toContain('This is how it works');
    });

    it('should skip malformed JSONL lines gracefully', () => {
      const tmpPath = join(tmpdir(), `cll-malformed-${Date.now()}.jsonl`);
      const content = [
        '{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2026-01-01T00:00:00Z","sessionId":"bad-001"}',
        'NOT_VALID_JSON{{{{',
        '{"type":"assistant","message":{"role":"assistant","content":"World"},"timestamp":"2026-01-01T00:00:01Z","sessionId":"bad-001"}',
      ].join('\n');

      writeFileSync(tmpPath, content, 'utf-8');

      try {
        const session = parseSessionFile(tmpPath);
        expect(session).not.toBeNull();
        // Only 2 valid messages, malformed line was skipped
        expect(session!.messages.length).toBe(2);
        expect(session!.messages[0].type).toBe('user');
        expect(session!.messages[1].type).toBe('assistant');
      } finally {
        unlinkSync(tmpPath);
      }
    });

    it('should return null for empty session file', () => {
      const tmpPath = join(tmpdir(), `cll-empty-${Date.now()}.jsonl`);
      writeFileSync(tmpPath, '', 'utf-8');

      try {
        const session = parseSessionFile(tmpPath);
        expect(session).toBeNull();
      } finally {
        unlinkSync(tmpPath);
      }
    });

    it('should return null when all lines parse but produce no messages', () => {
      const tmpPath = join(tmpdir(), `cll-nomsg-${Date.now()}.jsonl`);
      // 'result' type is not in validTypes, so no messages are produced
      const content = '{"type":"result","timestamp":"2026-01-01T00:00:00Z","sessionId":"no-msg-001"}\n';
      writeFileSync(tmpPath, content, 'utf-8');

      try {
        const session = parseSessionFile(tmpPath);
        expect(session).toBeNull();
      } finally {
        unlinkSync(tmpPath);
      }
    });

    it('should extract sessionId from first entry', () => {
      const sessionPath = join(fixturesDir, 'correction-session.jsonl');
      const session = parseSessionFile(sessionPath);

      expect(session).not.toBeNull();
      expect(session!.id).toBe('test-002');
    });

    it('should set startedAt from first entry timestamp', () => {
      const sessionPath = join(fixturesDir, 'simple-session.jsonl');
      const session = parseSessionFile(sessionPath);

      expect(session).not.toBeNull();
      expect(session!.startedAt).toBeInstanceOf(Date);
      expect(session!.startedAt.toISOString()).toBe('2026-03-23T10:00:00.000Z');
    });
  });

  describe('extractText', () => {
    it('should extract text from string content message', () => {
      const msg: SessionMessage = {
        type: 'user',
        content: 'Hello world',
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test',
      };
      expect(extractText(msg)).toBe('Hello world');
    });

    it('should extract text from ContentBlock[] message', () => {
      const msg: SessionMessage = {
        type: 'assistant',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test',
      };
      const text = extractText(msg);
      expect(text).toContain('Part 1');
      expect(text).toContain('Part 2');
    });

    it('should handle tool_use block (return empty for tool_use)', () => {
      const msg: SessionMessage = {
        type: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } },
        ],
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test',
      };
      // tool_use has no text/thinking fields → extractText returns empty string
      const text = extractText(msg);
      expect(text).toBe('');
    });

    it('should extract text from thinking block', () => {
      const msg: SessionMessage = {
        type: 'assistant',
        content: [
          { type: 'thinking', thinking: 'I am thinking...' },
          { type: 'text', text: 'Result' },
        ],
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test',
      };
      const text = extractText(msg);
      expect(text).toContain('I am thinking...');
      expect(text).toContain('Result');
    });

    it('should return empty string for empty content array', () => {
      const msg: SessionMessage = {
        type: 'assistant',
        content: [],
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test',
      };
      expect(extractText(msg)).toBe('');
    });

    it('should return empty string for empty string content', () => {
      const msg: SessionMessage = {
        type: 'user',
        content: '',
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test',
      };
      expect(extractText(msg)).toBe('');
    });
  });
});
