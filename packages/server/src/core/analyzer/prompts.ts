import type { RawSession } from '@cll/shared';
import { extractText } from '../sources/claude-code.js';

export interface AnalyzerInput {
  sessions: SessionSummary[];
  existingRules: string[];
  categories: string[];
}

export interface SessionSummary {
  id: string;
  projectPath: string;
  correctionExcerpts: Array<{
    userCorrection: string;
    assistantContext: string;
  }>;
}

export function buildAnalyzerPrompt(input: AnalyzerInput): string {
  const sessionText = input.sessions.map((s, i) => {
    const excerpts = s.correctionExcerpts.map(e =>
      `  Assistant: ${e.assistantContext.slice(0, 200)}...\n  User correction: ${e.userCorrection}`
    ).join('\n\n');
    return `Session ${i + 1} (${s.id.slice(0, 8)}):\n${excerpts}`;
  }).join('\n\n---\n\n');

  const existingRulesText = input.existingRules.length > 0
    ? `\nExisting rules (do NOT duplicate these):\n${input.existingRules.map(r => `- ${r}`).join('\n')}\n`
    : '';

  return `You are analyzing Claude Code sessions to extract learning rules.

Analyze these sessions where the user corrected Claude's behavior:

${sessionText}

${existingRulesText}

Categories available: ${input.categories.join(', ')}

For each pattern of correction you find, return a JSON improvement object.
Return a JSON array (may be empty [] if no clear patterns). Format:
[
  {
    "category": "code_quality",
    "severity": "high",
    "whatHappened": "Brief description of what Claude did wrong",
    "userCorrection": "What the user said to correct it",
    "suggestedRule": "Actionable rule Claude should follow in the future",
    "applyTo": "claude_md"
  }
]

Rules for good suggestions:
- suggestedRule must be actionable and specific (not vague)
- severity: high = major error, medium = notable, low = minor
- applyTo: always "claude_md" unless it's a project-specific setting
- Do not invent corrections not present in the sessions
- Return ONLY the JSON array, no explanation`;
}

export function buildSystemPrompt(): string {
  return 'You analyze user-AI conversation sessions to extract behavioral learning rules. Be precise and only suggest rules based on evidence in the sessions provided. Return only valid JSON.';
}

export function extractCorrectionExcerpts(
  messages: RawSession['messages'],
  corrections: Array<{ messageIndex: number }>,
): SessionSummary['correctionExcerpts'] {
  return corrections.map(({ messageIndex }) => {
    const userMsg = messages[messageIndex];
    const assistantMsg = messageIndex > 0 ? messages[messageIndex - 1] : null;
    return {
      userCorrection: extractText(userMsg).slice(0, 300),
      assistantContext: assistantMsg ? extractText(assistantMsg).slice(0, 300) : '',
    };
  });
}
