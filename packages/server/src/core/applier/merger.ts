import { getClaudeClient } from '../../claude/client.js';
import { buildMergePrompt, buildSystemPrompt } from '../analyzer/prompts.js';
import { logger } from '../../utils/logger.js';

/**
 * Merge existing rules + new rules into an optimized set via Claude.
 * Deduplicates overlapping rules, removes subsumed ones, rewrites for conciseness.
 * Returns the final merged rule list (max 15).
 */
export async function mergeRules(existingRules: string[], newRules: string[]): Promise<string[]> {
  if (newRules.length === 0) return existingRules;
  if (existingRules.length === 0) return newRules;

  const prompt = buildMergePrompt(existingRules, newRules);
  const systemPrompt = buildSystemPrompt();

  const client = getClaudeClient();
  let responseText: string;

  try {
    const response = await client.call({ prompt, systemPrompt });
    responseText = response.content;
  } catch (err) {
    logger.error('Merge rules Claude call failed', { error: String(err) });
    // Fallback: just append new rules (no merge)
    return [...existingRules, ...newRules];
  }

  const merged = parseMergeResponse(responseText);
  if (merged.length === 0) {
    logger.warn('Merge returned empty result, falling back to append');
    return [...existingRules, ...newRules];
  }

  logger.info('Rules merged', {
    before: existingRules.length + newRules.length,
    after: merged.length,
  });

  return merged;
}

function parseMergeResponse(text: string): string[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(s => s.trim());
  } catch {
    return [];
  }
}
