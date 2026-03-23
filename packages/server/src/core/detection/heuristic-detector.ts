import type { SessionMessage, DetectionResult, DetectedCorrection, CorrectionMatch } from '@cll/shared';
import { DEFAULT_HEURISTIC_THRESHOLD } from '@cll/shared';
import { VIETNAMESE_PATTERNS, ENGLISH_PATTERNS, SKIP_PATTERNS } from './patterns.js';
import { extractText } from '../sources/claude-code.js';

export class HeuristicDetector {
  constructor(private threshold: number = DEFAULT_HEURISTIC_THRESHOLD) {}

  detect(messages: SessionMessage[]): DetectionResult {
    const corrections: DetectedCorrection[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Only analyze user messages
      if (message.type !== 'user') continue;

      const text = extractText(message);

      // Skip system/tool messages
      if (shouldSkip(text)) continue;

      // Check patterns
      const matches = findPatternMatches(text);

      // Check behavioral patterns
      const behaviorMatches = checkBehavioralPatterns(messages, i);
      matches.push(...behaviorMatches);

      if (matches.length === 0) continue;

      // Calculate combined confidence (max of all matches)
      const confidence = Math.max(...matches.map(m => m.confidence));

      if (confidence >= this.threshold) {
        corrections.push({
          messageIndex: i,
          text: text.slice(0, 500), // truncate long texts
          confidence,
          patterns: matches,
        });
      }
    }

    return {
      hasCorrections: corrections.length > 0,
      corrections,
      correctionCount: corrections.length,
    };
  }
}

function shouldSkip(text: string): boolean {
  const lower = text.toLowerCase();
  return SKIP_PATTERNS.some(pattern => lower.includes(pattern.toLowerCase()));
}

function findPatternMatches(text: string): CorrectionMatch[] {
  const lower = text.toLowerCase();
  const matches: CorrectionMatch[] = [];

  for (const pattern of [...VIETNAMESE_PATTERNS, ...ENGLISH_PATTERNS]) {
    if (lower.includes(pattern.text.toLowerCase())) {
      matches.push({
        pattern: pattern.text,
        confidence: pattern.confidence,
        category: pattern.category,
      });
    }
  }

  return matches;
}

function checkBehavioralPatterns(messages: SessionMessage[], currentIndex: number): CorrectionMatch[] {
  const matches: CorrectionMatch[] = [];
  const current = messages[currentIndex];
  const currentText = extractText(current);

  // Behavioral 1: Very short user message (<20 chars) after long assistant message (>500 chars)
  if (currentIndex > 0) {
    const prev = messages[currentIndex - 1];
    if (prev.type === 'assistant') {
      const prevText = extractText(prev);
      if (currentText.trim().length < 20 && prevText.length > 500) {
        matches.push({
          pattern: 'short-after-long',
          confidence: 0.5,
          category: 'behavioral',
        });
      }
    }
  }

  // Behavioral 2: [Request interrupted by user]
  if (currentText.includes('[Request interrupted by user]')) {
    matches.push({
      pattern: 'request-interrupted',
      confidence: 0.7,
      category: 'behavioral',
    });
  }

  // Behavioral 3: Same request sent twice in 3 messages
  if (currentIndex >= 2) {
    const prev2 = messages[currentIndex - 2];
    if (prev2.type === 'user') {
      const prev2Text = extractText(prev2).toLowerCase();
      const currTextLower = currentText.toLowerCase();
      if (
        prev2Text.length > 10 &&
        currTextLower.length > 10 &&
        similarity(prev2Text, currTextLower) > 0.85
      ) {
        matches.push({
          pattern: 'repeated-request',
          confidence: 0.6,
          category: 'behavioral',
        });
      }
    }
  }

  return matches;
}

// Simple string similarity (Jaccard on words)
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export const heuristicDetector = new HeuristicDetector();
