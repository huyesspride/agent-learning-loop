export interface CorrectionMatch {
  pattern: string;
  confidence: number;
  category: 'vietnamese' | 'english' | 'behavioral';
}

export interface DetectedCorrection {
  messageIndex: number;
  text: string;
  confidence: number;
  patterns: CorrectionMatch[];
}

export interface DetectionResult {
  hasCorrections: boolean;
  corrections: DetectedCorrection[];
  correctionCount: number;
}
