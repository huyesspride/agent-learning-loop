import type { RawSession, SessionMessage, ContentBlock } from '@cll/shared';
import { extractText } from '../sources/claude-code.js';

export interface AnalyzerInput {
  sessions: SessionSummary[];
  existingRules: string[];
  categories: string[];
}

export interface SessionSummary {
  id: string;
  projectPath: string;
  narrative: string; // compressed full session
}

export function buildAnalyzerPrompt(input: AnalyzerInput): string {
  const sessionText = input.sessions.map((s, i) =>
    `=== Session ${i + 1} (${s.id.slice(0, 8)}) | project: ${s.projectPath} ===\n${s.narrative}`
  ).join('\n\n');

  const existingRulesText = input.existingRules.length > 0
    ? `\nCác rule đã có (KHÔNG tạo rule trùng lặp):\n${input.existingRules.map(r => `- ${r}`).join('\n')}\n`
    : '';

  return `Bạn là chuyên gia phân tích hành vi AI. Hãy đọc kỹ toàn bộ session làm việc dưới đây và tìm ra MỌI vấn đề — không chỉ những chỗ người dùng nói "sai" hay "sửa lại".

Tìm kiếm các loại vấn đề sau:
- Claude đọc sai file/sử dụng sai dữ liệu (ví dụ: đọc file state thay vì diff)
- Claude đưa ra giả định mà không verify (ví dụ: assume target branch sai)
- Claude spawn agent/tool sai thứ tự hoặc khi chưa có đủ thông tin
- Claude claim kỹ thuật nhưng không đọc đủ context (từ diff bị truncate, v.v.)
- Claude thiếu quy trình bắt buộc (missing steps, skipped verification)
- Claude giải thích sai kỹ thuật (sai algorithm, sai behavior)
- Claude làm việc inefficient (lặp lại thao tác, đọc nhiều lần file không cần thiết)
- Bất kỳ hành vi nào khiến người dùng phải sửa, giải thích lại, hoặc cảm thấy thất vọng

${sessionText}

${existingRulesText}

Các category: ${input.categories.join(', ')}

Trả về JSON array với các improvement tìm được (rỗng [] nếu không có vấn đề):
[
  {
    "category": "workflow",
    "severity": "high",
    "whatHappened": "Mô tả cụ thể Claude đã làm sai điều gì (dựa trên bằng chứng trong session)",
    "userCorrection": "Người dùng đã phản hồi/sửa như thế nào (hoặc null nếu Claude tự mắc lỗi không ai sửa)",
    "suggestedRule": "Rule hành vi cụ thể, có thể áp dụng ngay, không mơ hồ",
    "applyTo": "claude_md"
  }
]

Yêu cầu bắt buộc:
- Viết tất cả văn bản bằng tiếng Việt
- suggestedRule phải actionable: "Khi X, luôn Y trước khi Z" không phải "Hãy cẩn thận hơn"
- severity: high = gây ra kết quả sai/mất thời gian nhiều, medium = inefficient, low = minor
- Dựa trên bằng chứng thực trong session, không bịa
- Chỉ trả về JSON array, không có text nào khác`;
}

export function buildSystemPrompt(): string {
  return 'Bạn là chuyên gia phân tích hành vi AI, đặc biệt giỏi nhận ra các anti-pattern và lỗi quy trình trong các session làm việc. Đọc toàn bộ conversation flow bao gồm tool calls để hiểu Claude đã làm gì và tại sao sai. Viết bằng tiếng Việt. Chỉ trả về JSON hợp lệ.';
}

/**
 * Build a compressed narrative of the full session including tool calls.
 * Keeps user messages full, summarizes assistant actions by tool name + brief text.
 * Targets ~6000 chars max per session.
 * @param messageOffset skip the first N messages (already analyzed in previous scan)
 */
export function buildSessionNarrative(messages: RawSession['messages'], messageOffset = 0): string {
  messages = messages.slice(messageOffset);
  const lines: string[] = [];
  let charCount = 0;
  const MAX_CHARS = 6000;
  const MAX_USER_MSG = 500;
  const MAX_ASST_TEXT = 150;

  for (let i = 0; i < messages.length && charCount < MAX_CHARS; i++) {
    const msg = messages[i];
    if (msg.type !== 'user' && msg.type !== 'assistant') continue;

    if (msg.type === 'user') {
      const text = extractText(msg).trim();
      if (!text || text.length < 3) continue;
      // Skip pure tool result messages
      if (isToolResultOnly(msg)) continue;
      const truncated = text.slice(0, MAX_USER_MSG);
      const line = `[User] ${truncated}${text.length > MAX_USER_MSG ? '...' : ''}`;
      lines.push(line);
      charCount += line.length;
    } else {
      // Assistant: extract tool calls + brief text
      const tools = extractToolCalls(msg);
      const text = extractText(msg).trim().slice(0, MAX_ASST_TEXT);
      const parts: string[] = [];
      if (tools.length > 0) parts.push(`tools:[${tools.join(', ')}]`);
      if (text) parts.push(text);
      if (parts.length === 0) continue;
      const line = `[Claude] ${parts.join(' | ')}`;
      lines.push(line);
      charCount += line.length;
    }
  }

  return lines.join('\n');
}

function isToolResultOnly(msg: SessionMessage): boolean {
  const { content } = msg;
  if (!Array.isArray(content)) return false;
  return content.every((b: ContentBlock) => b.type === 'tool_result');
}

function extractToolCalls(msg: SessionMessage): string[] {
  const { content } = msg;
  if (!Array.isArray(content)) return [];
  return (content as ContentBlock[])
    .filter((b): b is ContentBlock & { type: 'tool_use' } => b.type === 'tool_use')
    .map(b => b.name ?? 'unknown');
}

