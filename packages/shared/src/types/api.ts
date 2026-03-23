import type { Improvement, ImprovementStatus, Severity } from './improvement.js';
import type { RuleChange } from './rule.js';

// Re-export for convenience
export type { Improvement, ImprovementStatus, Severity, RuleChange };

// Dashboard
export interface DashboardData {
  totalSessions: number;
  analyzedSessions: number;
  pendingSessions: number;
  totalImprovements: number;
  pendingImprovements: number;
  appliedRules: number;
  correctionRate: number;
  recentRuns: RunSummary[];
  correctionTrend: TrendPoint[];
}

export interface RunSummary {
  id: number;
  runType: 'scan' | 'optimize';
  startedAt: string;
  completedAt?: string;
  status: string;
  stats?: Record<string, number>;
}

export interface TrendPoint {
  date: string;
  correctionRate: number;
  sessionCount: number;
}

// Scan
export interface ScanRequest {
  projectPaths?: string[];
  options?: {
    includeSubagents?: boolean;
    maxSessionAge?: number;
  };
}

export interface ScanStartResponse {
  runId: number;
  message: string;
}

export type ScanPhase = 'collect' | 'detect' | 'analyze' | 'complete' | 'error';

export interface ScanProgress {
  phase: ScanPhase;
  total?: number;
  withCorrections?: number;
  skipped?: number;
  batch?: string;
  improvements?: number;
  runId?: number;
  error?: string;
}

// Improvements
export interface ImprovementFilters {
  status?: ImprovementStatus;
  category?: string;
  severity?: Severity;
  sourceId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedImprovements {
  items: Improvement[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateImprovementRequest {
  status: 'approved' | 'edited' | 'skipped';
  editedRule?: string;
}

// Apply
export interface ApplyRequest {
  improvementIds: string[];
}

export interface ApplyResponse {
  applied: number;
  backupId: number;
}

export interface DryRunResponse {
  before: string;
  after: string;
  changes: RuleChange[];
}

// Stats
export interface StatsData {
  correctionRateByCategory: Record<string, number>;
  improvementsByStatus: Record<string, number>;
  sessionsByDay: TrendPoint[];
}
