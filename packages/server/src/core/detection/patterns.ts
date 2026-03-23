export interface Pattern {
  text: string;
  confidence: number;
  category: 'vietnamese' | 'english' | 'behavioral';
}

// Vietnamese HIGH confidence (0.9)
export const VIETNAMESE_PATTERNS: Pattern[] = [
  { text: 'sai rồi', confidence: 0.9, category: 'vietnamese' },
  { text: 'không đúng', confidence: 0.9, category: 'vietnamese' },
  { text: 'sửa lại', confidence: 0.9, category: 'vietnamese' },
  { text: 'làm lại', confidence: 0.9, category: 'vietnamese' },
  { text: 'không phải vậy', confidence: 0.9, category: 'vietnamese' },
  { text: 'đừng làm vậy', confidence: 0.85, category: 'vietnamese' },
  { text: 'đừng', confidence: 0.75, category: 'vietnamese' },
  { text: 'bịa', confidence: 0.85, category: 'vietnamese' },
  { text: 'đoán', confidence: 0.75, category: 'vietnamese' },
  { text: 'đọc docs', confidence: 0.85, category: 'vietnamese' },
  { text: 'check docs', confidence: 0.8, category: 'vietnamese' },
  { text: 'không phải như vậy', confidence: 0.9, category: 'vietnamese' },
  { text: 'không được', confidence: 0.8, category: 'vietnamese' },
  { text: 'thử lại', confidence: 0.8, category: 'vietnamese' },
  { text: 'sai', confidence: 0.7, category: 'vietnamese' }, // short, lower confidence
];

// English MEDIUM confidence (0.7)
export const ENGLISH_PATTERNS: Pattern[] = [
  { text: 'wrong', confidence: 0.8, category: 'english' },
  { text: 'incorrect', confidence: 0.8, category: 'english' },
  { text: "that's not right", confidence: 0.85, category: 'english' },
  { text: "that's wrong", confidence: 0.85, category: 'english' },
  { text: 'not what i asked', confidence: 0.8, category: 'english' },
  { text: "don't do that", confidence: 0.75, category: 'english' },
  { text: "don't", confidence: 0.6, category: 'english' },
  { text: 'stop', confidence: 0.65, category: 'english' },
  { text: 'fix this', confidence: 0.75, category: 'english' },
  { text: 'try again', confidence: 0.75, category: 'english' },
  { text: 'read the docs', confidence: 0.8, category: 'english' },
  { text: 'check the docs', confidence: 0.8, category: 'english' },
  { text: 'no,', confidence: 0.7, category: 'english' },
  { text: "you're wrong", confidence: 0.85, category: 'english' },
  { text: 'actually,', confidence: 0.5, category: 'english' }, // weaker signal
];

// Skip patterns
export const SKIP_PATTERNS: string[] = [
  '<command-message>',
  '<task-notification>',
  '<system-reminder>',
];
