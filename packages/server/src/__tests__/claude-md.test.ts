import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { ClaudeMdTarget, parseInstructionFile, buildInstructionFile } from '../core/applier/claude-md.js';
import { CLL_MARKER_START, CLL_MARKER_END } from '@cll/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures', 'claude-md');

describe('parseInstructionFile', () => {
  it('should parse file without CLL block', () => {
    const content = readFileSync(join(fixturesDir, 'with-user-content.md'), 'utf-8');
    const result = parseInstructionFile(content);
    expect(result.cllRules).toHaveLength(0);
    expect(result.userContent).toContain('TypeScript strict mode');
  });

  it('should parse file with CLL block', () => {
    const content = readFileSync(join(fixturesDir, 'with-cll-rules.md'), 'utf-8');
    const result = parseInstructionFile(content);
    expect(result.cllRules).toHaveLength(2);
    expect(result.cllRules[0]).toContain('API');
    expect(result.userContent).toContain('TypeScript strict mode');
    expect(result.userContent).not.toContain('CLL:START');
  });

  it('should handle malformed file (missing end marker)', () => {
    const content = readFileSync(join(fixturesDir, 'malformed.md'), 'utf-8');
    // CLL:START is present but CLL:END is missing → endIdx === -1 → treated as no CLL block
    const result = parseInstructionFile(content);
    expect(result.cllRules).toHaveLength(0);
  });

  it('should handle empty file', () => {
    const result = parseInstructionFile('');
    expect(result.userContent).toBe('');
    expect(result.cllRules).toHaveLength(0);
  });

  it('should correctly extract both rules from CLL block', () => {
    const content = readFileSync(join(fixturesDir, 'with-cll-rules.md'), 'utf-8');
    const result = parseInstructionFile(content);
    expect(result.cllRules[0]).toBe('Không đoán về API. Luôn đọc docs trước.');
    expect(result.cllRules[1]).toBe('Kiểm tra return type của hàm trước khi dùng.');
  });

  it('should return ruleCount matching cllRules length', () => {
    const content = readFileSync(join(fixturesDir, 'with-cll-rules.md'), 'utf-8');
    const result = parseInstructionFile(content);
    expect(result.ruleCount).toBe(result.cllRules.length);
  });

  it('should not include metadata comment line in rules', () => {
    const content = readFileSync(join(fixturesDir, 'with-cll-rules.md'), 'utf-8');
    const result = parseInstructionFile(content);
    // None of the rules should start with <!--
    for (const rule of result.cllRules) {
      expect(rule.trim().startsWith('<!--')).toBe(false);
    }
  });
});

describe('buildInstructionFile', () => {
  it('should include CLL markers when rules exist', () => {
    const output = buildInstructionFile({
      userContent: '# Rules',
      cllRules: ['Rule 1'],
      ruleCount: 1,
      wordCount: 2,
      rawContent: '',
    });
    expect(output).toContain(CLL_MARKER_START);
    expect(output).toContain(CLL_MARKER_END);
  });

  it('should not include CLL markers when no rules', () => {
    const output = buildInstructionFile({
      userContent: '# Rules',
      cllRules: [],
      ruleCount: 0,
      wordCount: 2,
      rawContent: '',
    });
    expect(output).not.toContain(CLL_MARKER_START);
    expect(output).not.toContain(CLL_MARKER_END);
  });

  it('should format rules as markdown list items', () => {
    const output = buildInstructionFile({
      userContent: '',
      cllRules: ['Rule A', 'Rule B'],
      ruleCount: 2,
      wordCount: 4,
      rawContent: '',
    });
    expect(output).toContain('- Rule A');
    expect(output).toContain('- Rule B');
  });

  it('should preserve userContent before CLL block', () => {
    const output = buildInstructionFile({
      userContent: '# My Project',
      cllRules: ['Rule 1'],
      ruleCount: 1,
      wordCount: 2,
      rawContent: '',
    });
    expect(output.indexOf('# My Project')).toBeLessThan(output.indexOf(CLL_MARKER_START));
  });
});

describe('ClaudeMdTarget', () => {
  const target = new ClaudeMdTarget();
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = join(tmpdir(), `cll-test-${Date.now()}.md`);
  });

  afterEach(() => {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  });

  it('should read file without CLL block', () => {
    const content = readFileSync(join(fixturesDir, 'with-user-content.md'), 'utf-8');
    writeFileSync(tmpFile, content);
    const result = target.read(tmpFile);
    expect(result.cllRules).toHaveLength(0);
    expect(result.userContent.length).toBeGreaterThan(0);
  });

  it('should return empty InstructionFile for non-existent file', () => {
    const result = target.read('/tmp/does-not-exist-cll-test.md');
    expect(result.userContent).toBe('');
    expect(result.cllRules).toHaveLength(0);
  });

  it('should write rules without corrupting userContent', () => {
    const userContent = '# My Rules\n\nAlways test your code.';
    writeFileSync(tmpFile, userContent);

    const existing = target.read(tmpFile);
    existing.cllRules = ['New rule 1', 'New rule 2'];

    target.write(tmpFile, existing);

    const result = target.read(tmpFile);
    expect(result.userContent).toContain('Always test your code');
    expect(result.cllRules).toHaveLength(2);
    expect(result.cllRules[0]).toBe('New rule 1');
  });

  it('should include CLL markers in written file', () => {
    const instructionFile = {
      userContent: '# Rules',
      cllRules: ['Rule 1'],
      ruleCount: 1,
      wordCount: 2,
      rawContent: '',
    };
    target.write(tmpFile, instructionFile);
    const written = readFileSync(tmpFile, 'utf-8');
    expect(written).toContain(CLL_MARKER_START);
    expect(written).toContain(CLL_MARKER_END);
    expect(written).toContain('- Rule 1');
  });

  it('should not write to file system when dryRun: true', () => {
    const instructionFile = {
      userContent: 'test',
      cllRules: ['rule'],
      ruleCount: 1,
      wordCount: 1,
      rawContent: '',
    };
    target.write(tmpFile, instructionFile, { dryRun: true });
    expect(existsSync(tmpFile)).toBe(false);
  });

  it('should validate duplicate rules', () => {
    const result = target.validate({
      userContent: '',
      cllRules: ['same rule', 'same rule'],
      ruleCount: 2,
      wordCount: 4,
      rawContent: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate empty rules as invalid', () => {
    const result = target.validate({
      userContent: '',
      cllRules: ['valid rule', '   '],
      ruleCount: 2,
      wordCount: 2,
      rawContent: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate file with unique non-empty rules as valid', () => {
    const result = target.validate({
      userContent: '',
      cllRules: ['Rule one', 'Rule two'],
      ruleCount: 2,
      wordCount: 4,
      rawContent: '',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should round-trip: write then read produces same rules', () => {
    const rules = ['Always use strict TypeScript', 'Never skip tests'];
    const instructionFile = {
      userContent: '# Project',
      cllRules: rules,
      ruleCount: rules.length,
      wordCount: 10,
      rawContent: '',
    };

    target.write(tmpFile, instructionFile);
    const readBack = target.read(tmpFile);

    expect(readBack.cllRules).toHaveLength(2);
    expect(readBack.cllRules[0]).toBe(rules[0]);
    expect(readBack.cllRules[1]).toBe(rules[1]);
  });

  it('should have type property "claude_md"', () => {
    expect(target.type).toBe('claude_md');
  });
});
