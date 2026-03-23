import { describe, it, expect } from 'vitest';
import { HeuristicDetector } from '../core/detection/heuristic-detector.js';
import type { SessionMessage } from '@cll/shared';

function makeUserMsg(content: string, index = 0): SessionMessage {
  return {
    type: 'user',
    content,
    timestamp: `2026-01-01T00:00:0${index}Z`,
    sessionId: 'test',
  };
}

function makeAssistantMsg(content: string, index = 0): SessionMessage {
  return {
    type: 'assistant',
    content,
    timestamp: `2026-01-01T00:00:0${index}Z`,
    sessionId: 'test',
  };
}

describe('HeuristicDetector', () => {
  const detector = new HeuristicDetector(0.6);

  it('should detect Vietnamese corrections', () => {
    const messages = [
      makeAssistantMsg('Đây là câu trả lời', 0),
      makeUserMsg('Sai rồi, cần làm lại', 1),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
    expect(result.correctionCount).toBe(1);
    expect(result.corrections[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('should detect English corrections', () => {
    const messages = [
      makeAssistantMsg('Here is my answer', 0),
      makeUserMsg("That's wrong, try again", 1),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
  });

  it('should skip <command-message> content', () => {
    const messages = [
      makeUserMsg('<command-message>sai rồi</command-message>', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(false);
  });

  it('should skip non-user messages', () => {
    const messages = [
      makeAssistantMsg('Sai rồi, tôi đã nhầm', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(false);
  });

  it('should not detect when confidence below threshold', () => {
    const messages = [
      makeUserMsg('Actually, I think that is fine', 0),
    ];
    // "actually," has confidence 0.5, below threshold 0.6 → no correction
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(false);
  });

  it('should detect behavioral pattern: short after long, combined with keyword', () => {
    // short-after-long alone has confidence 0.5 (below threshold).
    // Add a keyword ("wrong") to push confidence to 0.8 so threshold is met.
    const longText = 'A'.repeat(600);
    const messages = [
      makeAssistantMsg(longText, 0),
      makeUserMsg('wrong', 1), // < 20 chars AND contains "wrong" (conf 0.8)
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
    expect(result.corrections[0].patterns.some(p => p.pattern === 'short-after-long')).toBe(true);
  });

  it('should detect [Request interrupted by user]', () => {
    const messages = [
      makeUserMsg('[Request interrupted by user]', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
    expect(result.corrections[0].confidence).toBe(0.7);
  });

  it('should return hasCorrections: false when no patterns match', () => {
    const messages = [
      makeAssistantMsg('Đây là code mẫu', 0),
      makeUserMsg('Cảm ơn, hoạt động tốt!', 1),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(false);
    expect(result.correctionCount).toBe(0);
  });

  it('should detect repeated-request behavioral pattern', () => {
    // Same user message sent twice within 3 messages (similarity > 0.85)
    const messages = [
      makeUserMsg('Please write a function to calculate factorial', 0),
      makeAssistantMsg('Here is factorial...', 1),
      makeUserMsg('Please write a function to calculate factorial', 2),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
    expect(result.corrections.some(c => c.patterns.some(p => p.pattern === 'repeated-request'))).toBe(true);
  });

  it('should skip <task-notification> content', () => {
    const messages = [
      makeUserMsg('<task-notification>sai rồi làm lại</task-notification>', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(false);
  });

  it('should skip <system-reminder> content', () => {
    const messages = [
      makeUserMsg('<system-reminder>wrong answer, try again</system-reminder>', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(false);
  });

  it('should handle empty messages array', () => {
    const result = detector.detect([]);
    expect(result.hasCorrections).toBe(false);
    expect(result.correctionCount).toBe(0);
    expect(result.corrections).toHaveLength(0);
  });

  it('should detect multiple corrections in one session', () => {
    const messages = [
      makeAssistantMsg('First answer', 0),
      makeUserMsg('Sai rồi', 1),
      makeAssistantMsg('Second answer', 2),
      makeUserMsg('Không đúng', 3),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
    expect(result.correctionCount).toBe(2);
  });

  it('should detect "không đúng như yêu cầu" as Vietnamese correction', () => {
    const messages = [
      makeUserMsg('Không đúng như yêu cầu, làm lại đi', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
  });

  it('should use confidence from highest-confidence pattern when multiple match', () => {
    // "sai rồi" (0.9) + "làm lại" (0.9) — max confidence should be 0.9
    const messages = [
      makeUserMsg('Sai rồi, làm lại ngay', 0),
    ];
    const result = detector.detect(messages);
    expect(result.hasCorrections).toBe(true);
    expect(result.corrections[0].confidence).toBe(0.9);
  });
});
