import type { RawSession } from '@cll/shared';
import { getClaudeClient } from '../../claude/client.js';
import { logger } from '../../utils/logger.js';
import { buildCrossSessionPrompt, buildSystemPrompt, buildSessionNarrative } from './prompts.js';
import { conflictDetector } from './conflict-detector.js';

export interface AnalysisInput {
  session: RawSession;
  existingRules: Array<{ id: string; content: string }>;
  categories: string[];
  messageOffset?: number; // skip already-analyzed messages (resumed sessions)
}

export interface RawImprovement {
  category: string;
  severity: string;
  whatHappened: string;
  userCorrection?: string;
  suggestedRule: string;
  applyTo: string;
  conflictWith?: string[];
}

export class ClaudeAnalyzer {
  async analyzeBatch(inputs: AnalysisInput[]): Promise<RawImprovement[]> {
    if (inputs.length === 0) return [];

    const sessionSummaries = inputs.map(input => ({
      id: input.session.id,
      projectPath: input.session.projectPath,
      narrative: buildSessionNarrative(input.session.messages, input.messageOffset ?? 0),
    }));

    // Merge existing rules for conflict checking (use first input's rules)
    const existingRules = inputs[0]?.existingRules ?? [];

    const prompt = buildCrossSessionPrompt({
      sessions: sessionSummaries,
      existingRules: existingRules.map(r => r.content),
      categories: inputs[0]?.categories ?? [],
    });

    const systemPrompt = buildSystemPrompt();

    const client = getClaudeClient();

    let responseText: string;
    try {
      const response = await client.call({ prompt, systemPrompt });
      responseText = response.content;
      logger.info('Analyzer response received', { chars: responseText.length, preview: responseText.slice(0, 300) });
    } catch (err) {
      logger.error('Claude analyzer call failed', { error: String(err) });
      return [];
    }

    // Parse JSON response
    const improvements = parseAnalyzerResponse(responseText);

    // Check conflicts for each improvement
    return improvements.map(imp => {
      const conflict = conflictDetector.check(imp.suggestedRule, existingRules);
      return {
        ...imp,
        conflictWith: conflict.conflictsWith.length > 0 ? conflict.conflictsWith : undefined,
      };
    });
  }
}

function parseAnalyzerResponse(text: string): Omit<RawImprovement, 'conflictWith'>[] {
  // Extract JSON from response (may have surrounding text)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logger.warn('No JSON array found in analyzer response', { text: text.slice(0, 200) });
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item =>
      item &&
      typeof item.category === 'string' &&
      typeof item.severity === 'string' &&
      typeof item.suggestedRule === 'string' &&
      item.suggestedRule.trim().length > 0
    );
  } catch (err) {
    logger.error('Failed to parse analyzer response', { error: String(err), text: text.slice(0, 200) });
    return [];
  }
}

export const claudeAnalyzer = new ClaudeAnalyzer();
