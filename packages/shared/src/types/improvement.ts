export type ImprovementStatus = 'pending' | 'approved' | 'edited' | 'skipped' | 'applied';
export type Severity = 'high' | 'medium' | 'low';
export type ApplyTarget = 'claude_md' | 'memory';

export interface Improvement {
  id: string;
  sessionId: string;
  sourceId: string;
  category: string;
  severity: Severity;
  whatHappened: string;
  userCorrection?: string;
  suggestedRule: string;
  applyTo: ApplyTarget;
  status: ImprovementStatus;
  editedRule?: string;
  note?: string;
  conflictWith?: string[]; // array of rule IDs
  reviewedAt?: Date;
  appliedAt?: Date;
  createdAt: Date;
}
