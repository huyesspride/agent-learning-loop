import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { CLL_MARKER_START, CLL_MARKER_END } from '@cll/shared';
import type { InstructionFile, WriteOptions, ValidationResult } from '@cll/shared';

export class ClaudeMdTarget {
  readonly type: string = 'claude_md';

  read(filePath: string): InstructionFile {
    if (!existsSync(filePath)) {
      return {
        userContent: '',
        cllRules: [],
        ruleCount: 0,
        wordCount: 0,
        rawContent: '',
      };
    }

    const rawContent = readFileSync(filePath, 'utf-8');
    return parseInstructionFile(rawContent);
  }

  write(filePath: string, content: InstructionFile, options?: WriteOptions): void {
    const dryRun = options?.dryRun ?? false;
    const newContent = buildInstructionFile(content);

    if (dryRun) return;

    // Ensure directory exists
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, newContent, 'utf-8');
  }

  validate(content: InstructionFile): ValidationResult {
    const errors: string[] = [];

    // Rules should be non-empty strings
    for (const rule of content.cllRules) {
      if (!rule.trim()) {
        errors.push('Empty rule detected');
        break;
      }
    }

    // Check for duplicates
    const unique = new Set(content.cllRules.map((r) => r.trim()));
    if (unique.size < content.cllRules.length) {
      errors.push('Duplicate rules detected');
    }

    return { valid: errors.length === 0, errors };
  }
}

export function parseInstructionFile(rawContent: string): InstructionFile {
  const startIdx = rawContent.indexOf(CLL_MARKER_START);
  const endIdx = rawContent.indexOf(CLL_MARKER_END);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    // No CLL block — entire content is user content
    return {
      userContent: rawContent.trimEnd(),
      cllRules: [],
      ruleCount: 0,
      wordCount: countWords(rawContent),
      rawContent,
    };
  }

  // Split: everything before CLL:START is userContent
  const userContent = rawContent.slice(0, startIdx).trimEnd();

  // Extract rules from between markers
  const blockContent = rawContent.slice(startIdx + CLL_MARKER_START.length, endIdx);
  const rules = extractRulesFromBlock(blockContent);

  return {
    userContent,
    cllRules: rules,
    ruleCount: rules.length,
    wordCount: countWords(rules.join(' ')),
    rawContent,
  };
}

function extractRulesFromBlock(blockContent: string): string[] {
  const lines = blockContent.split('\n');
  const rules: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip the metadata comment line (<!-- Updated: ... -->)
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) continue;
    // Collect lines that start with - (rule items)
    if (trimmed.startsWith('- ')) {
      rules.push(trimmed.slice(2)); // Remove "- " prefix
    }
  }

  return rules.filter((r) => r.trim());
}

export function buildInstructionFile(content: InstructionFile): string {
  const { userContent, cllRules } = content;
  const now = new Date().toISOString();
  const wordCount = countWords(cllRules.join(' '));

  const parts: string[] = [];

  if (userContent) {
    parts.push(userContent);
    parts.push('');
    parts.push('');
  }

  if (cllRules.length > 0) {
    parts.push('## CLL Learning Rules');
    parts.push(CLL_MARKER_START);
    parts.push(
      `<!-- Updated: ${now} | Rules: ${cllRules.length} | Words: ${wordCount} -->`,
    );
    for (const rule of cllRules) {
      parts.push(`- ${rule}`);
    }
    parts.push(CLL_MARKER_END);
  }

  return parts.join('\n') + '\n';
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const claudeMdTarget = new ClaudeMdTarget();

// ── Manual rule extraction ───────────────────────────────────────────────────

export interface ManualRule {
  syntheticId: string; // e.g. 'manual_0'
  content: string;
  section: string;     // heading name, e.g. 'Verification'
}

/** Extract all bullet-point rules from the non-CLL (user-written) sections of a CLAUDE.md file. */
export function extractManualRules(rawContent: string): ManualRule[] {
  const { userContent } = parseInstructionFile(rawContent);
  const lines = userContent.split('\n');
  const result: ManualRule[] = [];
  let currentSection = 'general';
  let idx = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
    } else if (line.trim().startsWith('- ')) {
      result.push({ syntheticId: `manual_${idx++}`, content: line.trim().slice(2), section: currentSection });
    }
  }

  return result;
}

/**
 * Apply retire/rewrite changes to bullet points in the userContent section of a CLAUDE.md file.
 * Changes are keyed by original rule content (not by line number).
 */
export function applyManualRuleChanges(
  rawContent: string,
  changes: Map<string, { action: 'retire' | 'rewrite'; newText?: string }>,
): string {
  const startIdx = rawContent.indexOf(CLL_MARKER_START);
  const userPart = startIdx === -1 ? rawContent : rawContent.slice(0, startIdx).trimEnd();
  const cllPart = startIdx === -1 ? '' : '\n\n' + rawContent.slice(startIdx);

  const newLines: string[] = [];
  for (const line of userPart.split('\n')) {
    if (line.trim().startsWith('- ')) {
      const content = line.trim().slice(2);
      const change = changes.get(content);
      if (!change) {
        newLines.push(line);
      } else if (change.action === 'rewrite' && change.newText) {
        const indent = line.match(/^(\s*)/)?.[1] ?? '';
        newLines.push(`${indent}- ${change.newText}`);
      }
      // retire: skip line
    } else {
      newLines.push(line);
    }
  }

  return newLines.join('\n') + cllPart;
}
