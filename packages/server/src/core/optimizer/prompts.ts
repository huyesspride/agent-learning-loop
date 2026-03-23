export interface RuleWithStats {
  id: string;
  content: string;
  category?: string;
  effectivenessScore?: number;
  effectivenessSampleCount: number;
  status: string;
}

export interface OptimizerAction {
  action: 'KEEP' | 'MERGE' | 'REWRITE' | 'RETIRE';
  ids?: string[];      // for MERGE (list of ids to merge)
  id?: string;         // for REWRITE or RETIRE
  newText?: string;    // for MERGE (merged text) or REWRITE (new text)
  reason?: string;
}

export function buildOptimizerPrompt(rules: RuleWithStats[], budget: { maxRules: number; maxWords: number }): string {
  const rulesText = rules.map((r, i) => {
    const score = r.effectivenessScore !== undefined
      ? `score: ${(r.effectivenessScore * 100).toFixed(0)}%`
      : `${r.effectivenessSampleCount} samples`;
    return `${i + 1}. [${r.id.slice(0, 8)}] ${r.content} (${r.category ?? 'general'}, ${score})`;
  }).join('\n');

  return `You are optimizing a CLAUDE.md rule set for clarity and effectiveness.

Current rules (${rules.length} total):
${rulesText}

Budget: max ${budget.maxRules} rules, max ${budget.maxWords} words.

For each rule, decide one action:
- KEEP: Rule is good as-is
- MERGE: Combine similar rules into one (provide merged text)
- REWRITE: Improve clarity without changing meaning
- RETIRE: Remove rule (low effectiveness, redundant, or not actionable)

Return a JSON array of actions:
[
  { "action": "KEEP", "id": "abc12345" },
  { "action": "MERGE", "ids": ["abc12345", "def67890"], "newText": "Merged rule text" },
  { "action": "REWRITE", "id": "ghi11111", "newText": "Improved rule text" },
  { "action": "RETIRE", "id": "jkl22222", "reason": "Too vague" }
]

Guidelines:
- Prefer fewer, clearer rules over many vague ones
- Rules must be actionable (tell Claude what to DO or NOT DO)
- Merge rules that cover the same behavior pattern
- Retire rules with 0 effectiveness after 10+ samples
- Return ONLY the JSON array, no explanation`;
}

export function buildOptimizerSystemPrompt(): string {
  return 'You optimize AI assistant behavioral rule sets for clarity, conciseness, and effectiveness. Return only valid JSON arrays.';
}
