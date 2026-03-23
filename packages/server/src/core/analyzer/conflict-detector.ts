export interface ConflictResult {
  hasConflict: boolean;
  conflictsWith: string[];
}

// Simple Jaccard similarity on words
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

export class ConflictDetector {
  check(newRule: string, existingRules: Array<{ id: string; content: string }>): ConflictResult {
    const conflicts: string[] = [];

    for (const existing of existingRules) {
      if (similarity(newRule, existing.content) > 0.8) {
        conflicts.push(existing.id);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflictsWith: conflicts,
    };
  }
}

export const conflictDetector = new ConflictDetector();
