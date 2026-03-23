export type RuleStatus = 'active' | 'retired';
export type RuleTarget = 'claude_md' | 'memory';

export interface ActiveRule {
  id: string;
  sourceId?: string;
  target: RuleTarget;
  projectPath?: string;
  content: string;
  category?: string;
  note?: string;
  originImprovementId?: string;
  addedAt: Date;
  effectivenessScore?: number;
  effectivenessBaselineRate?: number;
  effectivenessSampleCount: number;
  status: RuleStatus;
}

export interface RuleChange {
  action: 'add' | 'update' | 'remove';
  rule: string;
  category?: string;
  target: RuleTarget;
}
