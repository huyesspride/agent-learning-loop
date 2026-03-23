export {
  ClaudeMdTarget,
  claudeMdTarget,
  parseInstructionFile,
  buildInstructionFile,
} from './claude-md.js';
export { MemoryTarget, memoryTarget } from './memory.js';
export { BackupManager } from './backup.js';
export { Applier } from './applier.js';
export type {
  InstructionTarget,
  InstructionFile,
  WriteOptions,
  ValidationResult,
} from './instruction-target.js';
export type { ApplyOptions, ApplyResult, DryRunResult } from './applier.js';
