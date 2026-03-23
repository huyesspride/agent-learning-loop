import { z } from 'zod';
import {
  IMPROVEMENT_STATUSES,
  SEVERITIES,
  RULE_TARGETS,
  RULE_STATUSES,
  CATEGORIES,
  DEFAULT_PORT,
  DEFAULT_MAX_BATCH_SIZE,
  DEFAULT_MAX_CALLS_PER_SCAN,
  DEFAULT_HEURISTIC_THRESHOLD,
} from './constants.js';

// ── Primitive enums ──────────────────────────────────────────────────────────

export const ImprovementStatusSchema = z.enum(IMPROVEMENT_STATUSES);
export const SeveritySchema = z.enum(SEVERITIES);
export const RuleTargetSchema = z.enum(RULE_TARGETS);
export const RuleStatusSchema = z.enum(RULE_STATUSES);

// ── AppConfig ────────────────────────────────────────────────────────────────

export const AppConfigSchema = z.object({
  port: z.number().int().positive().default(DEFAULT_PORT),
  dbPath: z.string().min(1).default('data/cll.db'),
  claude: z
    .object({
      model: z.string().min(1).default('claude-opus-4-5'),
      maxBatchSize: z.number().int().positive().default(DEFAULT_MAX_BATCH_SIZE),
      maxCallsPerScan: z.number().int().positive().default(DEFAULT_MAX_CALLS_PER_SCAN),
      apiKey: z.string().optional(),
    })
    .default({}),
  scan: z
    .object({
      includeSubagents: z.boolean().default(true),
      maxSessionAge: z.number().int().positive().default(30),
      autoScanInterval: z.number().int().min(0).default(0),
    })
    .default({}),
  analysis: z
    .object({
      heuristicThreshold: z
        .number()
        .min(0)
        .max(1)
        .default(DEFAULT_HEURISTIC_THRESHOLD),
      categories: z.array(z.string()).default([...CATEGORIES]),
    })
    .default({}),
  privacy: z
    .object({
      redactEmails: z.boolean().default(true),
      redactApiKeys: z.boolean().default(true),
      redactPaths: z.boolean().default(false),
    })
    .default({}),
});

export type AppConfigInput = z.input<typeof AppConfigSchema>;
export type AppConfigOutput = z.output<typeof AppConfigSchema>;

// ── Scan ─────────────────────────────────────────────────────────────────────

export const ScanRequestSchema = z.object({
  projectPaths: z.array(z.string()).optional(),
  options: z
    .object({
      includeSubagents: z.boolean().optional(),
      maxSessionAge: z.number().int().positive().optional(),
    })
    .optional(),
});

// ── Improvement ───────────────────────────────────────────────────────────────

export const UpdateImprovementRequestSchema = z.object({
  status: z.enum(['approved', 'edited', 'skipped']),
  editedRule: z.string().optional(),
});

export const ImprovementFiltersSchema = z.object({
  status: ImprovementStatusSchema.optional(),
  category: z.string().optional(),
  severity: SeveritySchema.optional(),
  sourceId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

// ── Apply ─────────────────────────────────────────────────────────────────────

export const ApplyRequestSchema = z.object({
  improvementIds: z.array(z.string().min(1)).min(1),
});

// ── Rule ──────────────────────────────────────────────────────────────────────

export const RuleChangeSchema = z.object({
  action: z.enum(['add', 'update', 'remove']),
  rule: z.string().min(1),
  category: z.string().optional(),
  target: RuleTargetSchema,
});

export const ActiveRuleSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().optional(),
  target: RuleTargetSchema,
  projectPath: z.string().optional(),
  content: z.string().min(1),
  category: z.string().optional(),
  originImprovementId: z.string().optional(),
  addedAt: z.date(),
  effectivenessScore: z.number().min(0).max(1).optional(),
  effectivenessBaselineRate: z.number().min(0).max(1).optional(),
  effectivenessSampleCount: z.number().int().min(0),
  status: RuleStatusSchema,
});

// ── InstructionFile ────────────────────────────────────────────────────────────

export const InstructionFileSchema = z.object({
  userContent: z.string(),
  cllRules: z.array(z.string()),
  ruleCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
  rawContent: z.string(),
});
