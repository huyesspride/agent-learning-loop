export interface InstructionFile {
  userContent: string;
  cllRules: string[];
  ruleCount: number;
  wordCount: number;
  rawContent: string;
}

export interface WriteOptions {
  dryRun?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface InstructionTarget {
  readonly type: string;
  read(filePath: string): Promise<InstructionFile>;
  write(filePath: string, content: InstructionFile, options?: WriteOptions): Promise<void>;
  validate(content: InstructionFile): ValidationResult;
}
