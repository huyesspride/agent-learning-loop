export const IMPROVEMENT_STATUSES = ['pending', 'approved', 'edited', 'skipped', 'applied'] as const;
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export const RULE_TARGETS = ['claude_md', 'memory'] as const;
export const RULE_STATUSES = ['active', 'retired'] as const;
export const SESSION_SOURCES = ['claude_code', 'codex'] as const;

export const CLL_MARKER_START =
  '<!-- CLL:START - Managed by Claude Learning Loop - DO NOT EDIT -->';
export const CLL_MARKER_END = '<!-- CLL:END -->';

export const DEFAULT_HEURISTIC_THRESHOLD = 0.6;
export const DEFAULT_MAX_BATCH_SIZE = 5;
export const DEFAULT_MAX_CALLS_PER_SCAN = 5;
export const DEFAULT_PORT = 3939;

export const CATEGORIES = [
  'code_quality',
  'tool_usage',
  'factual_accuracy',
  'communication',
  'workflow',
] as const;
