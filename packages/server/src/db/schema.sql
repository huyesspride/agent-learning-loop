CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL DEFAULT 'claude_code',
  project_path TEXT NOT NULL,
  session_path TEXT NOT NULL UNIQUE,
  started_at DATETIME,
  message_count INTEGER DEFAULT 0,
  user_message_count INTEGER DEFAULT 0,
  correction_count INTEGER DEFAULT 0,
  analyzed_at DATETIME,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS improvements (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  source_id TEXT NOT NULL DEFAULT 'claude_code',
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  what_happened TEXT NOT NULL,
  user_correction TEXT,
  suggested_rule TEXT NOT NULL,
  apply_to TEXT NOT NULL DEFAULT 'claude_md',
  status TEXT NOT NULL DEFAULT 'pending',
  edited_rule TEXT,
  conflict_with TEXT,
  reviewed_at DATETIME,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS active_rules (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  target TEXT NOT NULL,
  project_path TEXT,
  content TEXT NOT NULL,
  category TEXT,
  origin_improvement_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  effectiveness_score REAL,
  effectiveness_baseline_rate REAL,
  effectiveness_sample_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  started_at DATETIME,
  completed_at DATETIME,
  status TEXT,
  stats TEXT,
  error TEXT,
  prompt_version TEXT
);

CREATE TABLE IF NOT EXISTS context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL DEFAULT 'claude_code',
  project_path TEXT,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  instruction_file_rules INTEGER,
  instruction_file_words INTEGER,
  total_active_rules INTEGER,
  correction_rate REAL
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  backup_type TEXT NOT NULL,
  run_id INTEGER REFERENCES runs(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_improvements_session ON improvements(session_id);
CREATE INDEX IF NOT EXISTS idx_improvements_status ON improvements(status);
CREATE INDEX IF NOT EXISTS idx_active_rules_status ON active_rules(status);
