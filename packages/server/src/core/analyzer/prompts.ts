import type { RawSession, SessionMessage, ContentBlock } from '@cll/shared';
import { extractText } from '../sources/claude-code.js';

export interface SessionSummary {
  id: string;
  projectPath: string;
  narrative: string;
}

export interface AnalyzerInput {
  sessions: SessionSummary[];
  existingRules: string[];
  categories: string[];
}

/**
 * Cross-session prompt: analyze multiple sessions together to find ROOT CAUSES,
 * not per-session surface symptoms. Returns max 5 high-quality rules.
 */
export function buildCrossSessionPrompt(input: AnalyzerInput): string {
  const sessionText = input.sessions.map((s, i) =>
    `=== Session ${i + 1} (${s.id.slice(0, 8)}) | project: ${s.projectPath} ===\n${s.narrative}`
  ).join('\n\n');

  const existingRulesText = input.existingRules.length > 0
    ? `\nCác rule đã có (KHÔNG tạo rule trùng lặp):\n${input.existingRules.map(r => `- ${r}`).join('\n')}\n`
    : '';

  return `Bạn là chuyên gia phân tích hành vi AI. Dưới đây là ${input.sessions.length} session làm việc của cùng một AI assistant.

Nhiệm vụ: Tìm ROOT CAUSE lặp lại — KHÔNG liệt kê từng sự cố riêng lẻ.

Root cause tốt có đặc điểm:
- Xuất hiện (trực tiếp hoặc gián tiếp) trong nhiều session
- Một rule duy nhất có thể ngăn được nhiều symptoms khác nhau
- Cụ thể: "Khi X, luôn Y trước khi Z" — không phải "Hãy cẩn thận hơn"
- Nếu một pattern chỉ xảy ra 1 lần, bỏ qua

${sessionText}

${existingRulesText}

Các category: ${input.categories.join(', ')}

Trả về JSON array TỐI ĐA 5 rules, ưu tiên root cause có impact rộng nhất (rỗng [] nếu không tìm được pattern đủ rõ):
[
  {
    "category": "workflow",
    "severity": "high",
    "whatHappened": "Mô tả pattern lặp lại qua nhiều session, kèm ví dụ cụ thể từ evidence",
    "userCorrection": "Cách user phải sửa hoặc phản hồi (null nếu không có correction rõ ràng)",
    "suggestedRule": "Rule hành vi cụ thể, actionable, áp dụng được ngay",
    "applyTo": "claude_md"
  }
]

Yêu cầu:
- Viết bằng tiếng Việt
- Tối đa 5 rules — chất lượng hơn số lượng
- Chỉ trả về JSON array, không có text nào khác`;
}

export function buildSystemPrompt(): string {
  return 'Bạn là chuyên gia phân tích hành vi AI, đặc biệt giỏi nhận ra ROOT CAUSE lặp lại qua nhiều session. Đọc toàn bộ conversation flow bao gồm tool calls để hiểu Claude đã làm gì và tại sao sai. Ưu tiên pattern có impact rộng. Viết bằng tiếng Việt. Chỉ trả về JSON hợp lệ.';
}

/**
 * Merge prompt: given existing rules + new rules, return an optimized merged set.
 * Deduplicates, merges similar, keeps distinct ones. Returns plain string array.
 */
export function buildMergePrompt(existingRules: string[], newRules: string[]): string {
  const existingText = existingRules.length > 0
    ? existingRules.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : '(chưa có rule nào)';

  const newText = newRules.map((r, i) => `${i + 1}. ${r}`).join('\n');

  return `Bạn nhận được 2 danh sách rules cho AI assistant.

Rules hiện tại:
${existingText}

Rules mới cần tích hợp:
${newText}

Nhiệm vụ: Tạo danh sách rules CUỐI CÙNG tối ưu:
- Merge rules có nội dung trùng/gần giống thành 1 rule rõ ràng hơn
- Giữ lại rules thực sự khác biệt
- Viết lại cho concise và actionable
- Không thêm rule không có trong input
- Giữ tối đa 15 rules tổng cộng

Trả về JSON array chỉ chứa nội dung rule (string), không có metadata:
["rule 1", "rule 2", ...]

Chỉ trả về JSON array, không có text nào khác.`;
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

