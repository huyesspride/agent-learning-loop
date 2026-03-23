// Types
export type {
  CollectOptions,
  ContentBlock,
  SessionMessage,
  RawSession,
  SessionSource,
} from './types/session.js';

export type {
  CorrectionMatch,
  DetectedCorrection,
  DetectionResult,
} from './types/correction.js';

export type {
  ImprovementStatus,
  Severity,
  ApplyTarget,
  Improvement,
} from './types/improvement.js';

export type {
  RuleStatus,
  RuleTarget,
  ActiveRule,
  RuleChange,
} from './types/rule.js';

export type {
  InstructionFile,
  WriteOptions,
  ValidationResult,
  InstructionTarget,
} from './types/instruction.js';

export type { AppConfig } from './types/config.js';

export type {
  DashboardData,
  RunSummary,
  TrendPoint,
  ScanRequest,
  ScanStartResponse,
  ScanPhase,
  ScanProgress,
  ImprovementFilters,
  PaginatedImprovements,
  UpdateImprovementRequest,
  ApplyRequest,
  ApplyResponse,
  DryRunResponse,
  StatsData,
} from './types/api.js';

// Constants
export {
  IMPROVEMENT_STATUSES,
  SEVERITIES,
  RULE_TARGETS,
  RULE_STATUSES,
  SESSION_SOURCES,
  CLL_MARKER_START,
  CLL_MARKER_END,
  DEFAULT_HEURISTIC_THRESHOLD,
  DEFAULT_MAX_BATCH_SIZE,
  DEFAULT_MAX_CALLS_PER_SCAN,
  DEFAULT_PORT,
  CATEGORIES,
} from './constants.js';

// Zod Schemas
export {
  ImprovementStatusSchema,
  SeveritySchema,
  RuleTargetSchema,
  RuleStatusSchema,
  AppConfigSchema,
  ScanRequestSchema,
  UpdateImprovementRequestSchema,
  ImprovementFiltersSchema,
  ApplyRequestSchema,
  RuleChangeSchema,
  ActiveRuleSchema,
  InstructionFileSchema,
} from './schemas.js';

export type { AppConfigInput, AppConfigOutput } from './schemas.js';
