# Claude Learning Loop (CLL) v4 — Final Plan

> Web-based tool để phân tích Claude/Codex sessions, trích xuất bài học, tối ưu CLAUDE.md + memory.
> Local web server, chạy manual, review trên browser, apply ngay vào local workspace.
> Hỗ trợ multi-agent (Claude Code, OpenAI Codex), multi-workspace, multi-machine.

---

## 1. Thiết kế tổng quan

### Triết lý

- **Web UI là trung tâm** — React SPA chạy trên localhost, dashboard + review + stats
- **Manual-first** — `cll` start server, mở browser, chạy khi mình muốn
- **Multi-agent** — Hỗ trợ cả Claude Code và OpenAI Codex sessions
- **Claude Code CLI** — gọi `claude -p` subprocess, dùng chung subscription, zero auth config
- **Local-first** — apply trực tiếp vào CLAUDE.md, memory trên máy hiện tại
- **Portable** — push lên GitHub, pull về máy khác, config workspace path là chạy

### Kiến trúc

```
Browser (localhost:3939)
  React SPA + Tailwind + shadcn/ui
         │
         │ REST API + SSE
         ↓
Express Server (:3939)
  ├── Routes (API endpoints)
  ├── Core Engine
  │   ├── Collector
  │   │   ├── Claude Code parser
  │   │   ├── Codex parser
  │   │   └── Correction detector
  │   ├── Analyzer (Claude CLI)
  │   ├── Optimizer (Claude CLI)
  │   └── Applier (CLAUDE.md, AGENTS.md, memory)
  ├── Claude CLI wrapper (child_process)
  ├── SQLite DB
  └── Config (YAML)
```

---

## 2. Tech Stack

| Layer           | Technology                         | Lý do                              |
|-----------------|------------------------------------|------------------------------------|
| **Frontend**    | React 19 + TypeScript              | Component-based, ecosystem lớn     |
| Styling         | Tailwind CSS 4                     | Utility-first, fast                |
| Components      | shadcn/ui                          | Copy-paste components, đẹp sẵn    |
| Charts          | Recharts                           | React-native charts                |
| Diff view       | react-diff-viewer-continued        | Syntax-highlighted diffs           |
| Code highlight  | Shiki                              | Syntax highlighting cho sessions   |
| State           | TanStack Query (React Query)       | Server state, auto-refetch         |
| Router          | React Router 7                     | SPA routing                        |
| Build           | Vite                               | Fast dev + build                   |
| **Backend**     | Express 5 + TypeScript             | Minimal, mature                    |
| Database        | better-sqlite3                     | Zero config, portable              |
| Validation      | Zod                                | Schema validation shared FE/BE     |
| Config          | YAML (js-yaml)                     | Dễ đọc, dễ edit tay               |
| **Claude**      | `claude -p` (child_process)        | Dùng chung subscription            |
| **CLI**         | Commander.js                       | `cll` command, start server        |
| **Package**     | pnpm + Turborepo                   | Monorepo FE + BE                   |

---

## 3. Project Structure

```
claude-learning-loop/
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
├── README.md
├── .env.example
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       ├── types.ts                 # API types, DB types, Agent types
│   │       ├── schemas.ts              # Zod schemas (shared FE/BE)
│   │       └── constants.ts            # Severities, categories, limits, agent types
│   │
│   ├── server/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                 # Express app + server start
│   │       │
│   │       ├── routes/
│   │       │   ├── dashboard.ts         # GET  /api/dashboard
│   │       │   ├── scan.ts             # POST /api/scan + GET /api/scan/status (SSE)
│   │       │   ├── improvements.ts     # CRUD improvements
│   │       │   ├── cleanups.ts         # CRUD cleanups
│   │       │   ├── optimize.ts         # POST /api/optimize + SSE
│   │       │   ├── apply.ts            # POST /api/apply + dry-run
│   │       │   ├── rules.ts            # CRUD rules + import/export
│   │       │   ├── sessions.ts         # GET sessions + session detail
│   │       │   ├── stats.ts            # GET stats + trends
│   │       │   ├── agents.ts           # GET/PATCH agent config
│   │       │   ├── workspaces.ts       # CRUD workspaces
│   │       │   ├── config.ts           # GET/PATCH config
│   │       │   └── rollback.ts         # GET snapshots + POST rollback
│   │       │
│   │       ├── core/
│   │       │   ├── collector/
│   │       │   │   ├── index.ts
│   │       │   │   ├── sources/
│   │       │   │   │   ├── claude-code.ts    # Parse ~/.claude/ JSONL
│   │       │   │   │   ├── codex.ts          # Parse Codex sessions
│   │       │   │   │   └── base.ts           # Abstract source interface
│   │       │   │   ├── correction-detector.ts
│   │       │   │   └── repo-scanner.ts
│   │       │   │
│   │       │   ├── analyzer/
│   │       │   │   ├── index.ts
│   │       │   │   ├── prompts.ts
│   │       │   │   ├── classifier.ts
│   │       │   │   └── conflict-detector.ts  # Check vs existing rules
│   │       │   │
│   │       │   ├── optimizer/
│   │       │   │   ├── index.ts
│   │       │   │   ├── prompts.ts
│   │       │   │   └── budget.ts
│   │       │   │
│   │       │   └── applier/
│   │       │       ├── index.ts
│   │       │       ├── targets/
│   │       │       │   ├── claude-md.ts      # CLAUDE.md for Claude Code
│   │       │       │   ├── agents-md.ts      # AGENTS.md for Codex
│   │       │       │   ├── memory.ts         # Memory format + copy
│   │       │       │   └── skills.ts         # Claude skills / Codex skills
│   │       │       ├── backup.ts
│   │       │       └── git-manager.ts        # Auto-commit (optional)
│   │       │
│   │       ├── claude/
│   │       │   └── client.ts                 # Claude CLI wrapper
│   │       │
│   │       ├── db/
│   │       │   ├── index.ts
│   │       │   ├── schema.sql
│   │       │   └── queries.ts
│   │       │
│   │       ├── config/
│   │       │   ├── loader.ts
│   │       │   └── defaults.ts
│   │       │
│   │       └── utils/
│   │           ├── logger.ts
│   │           ├── tokens.ts
│   │           ├── slack.ts
│   │           └── sse.ts
│   │
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── tailwind.config.ts
│       ├── components.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           │
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── Scan.tsx
│           │   ├── Review.tsx
│           │   ├── ReviewItem.tsx
│           │   ├── Optimize.tsx
│           │   ├── Rules.tsx
│           │   ├── Sessions.tsx
│           │   ├── SessionView.tsx
│           │   ├── Stats.tsx
│           │   ├── Agents.tsx              # Agent settings page
│           │   ├── Workspaces.tsx           # Multi-workspace management
│           │   └── Settings.tsx
│           │
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Sidebar.tsx
│           │   │   ├── Header.tsx
│           │   │   └── Layout.tsx
│           │   ├── dashboard/
│           │   │   ├── ContextHealth.tsx
│           │   │   ├── RecentActivity.tsx
│           │   │   ├── QuickActions.tsx
│           │   │   ├── StatsCards.tsx
│           │   │   └── LearningVelocity.tsx  # Correction rate trend
│           │   ├── review/
│           │   │   ├── ImprovementCard.tsx
│           │   │   ├── SeverityBadge.tsx
│           │   │   ├── CategoryBadge.tsx
│           │   │   ├── AgentBadge.tsx        # Claude / Codex badge
│           │   │   ├── RuleEditor.tsx
│           │   │   ├── DiffPreview.tsx
│           │   │   ├── ConflictWarning.tsx    # Conflict detection alert
│           │   │   ├── TargetSelector.tsx
│           │   │   └── ApplyButton.tsx
│           │   ├── optimize/
│           │   │   ├── CleanupCard.tsx
│           │   │   ├── MergePreview.tsx
│           │   │   └── SavingsSummary.tsx
│           │   ├── rules/
│           │   │   ├── RulesList.tsx
│           │   │   ├── RuleCard.tsx
│           │   │   ├── RuleEffectiveness.tsx  # Effectiveness score
│           │   │   ├── AddRuleDialog.tsx
│           │   │   ├── ImportExport.tsx        # Import/export UI
│           │   │   └── RuleSearch.tsx
│           │   ├── stats/
│           │   │   ├── BudgetChart.tsx
│           │   │   ├── IssuesChart.tsx
│           │   │   ├── CategoryPie.tsx
│           │   │   ├── VelocityChart.tsx       # Learning velocity
│           │   │   ├── EffectivenessTable.tsx
│           │   │   └── AgentComparison.tsx     # Compare agents
│           │   ├── session/
│           │   │   ├── MessageBubble.tsx
│           │   │   ├── CorrectionHighlight.tsx
│           │   │   ├── SessionMeta.tsx
│           │   │   └── AnnotationPanel.tsx     # Add notes to session
│           │   ├── agents/
│           │   │   ├── AgentCard.tsx
│           │   │   ├── AgentConfig.tsx
│           │   │   └── AgentStats.tsx
│           │   └── shared/
│           │       ├── ProgressBar.tsx
│           │       ├── ConfirmDialog.tsx
│           │       ├── CopyButton.tsx
│           │       ├── EmptyState.tsx
│           │       └── LoadingSpinner.tsx
│           │
│           ├── hooks/
│           │   ├── useApi.ts
│           │   ├── useScan.ts
│           │   └── useOptimize.ts
│           │
│           ├── lib/
│           │   ├── api.ts
│           │   └── utils.ts
│           │
│           └── styles/
│               └── globals.css
│
├── cli/
│   └── index.ts                              # CLI entry point
│
├── config/
│   ├── default.yaml
│   └── workspace.example.yaml
│
└── tests/
```

---

## 4. Config

### 4.1 Global: `~/.cll/config.yaml`

```yaml
claude:
  command: claude
  model: sonnet                          # daily analyze
  model_heavy: opus                      # optimize (cần chất lượng)
  timeout: 120
  max_retries: 2

server:
  port: 3939
  host: localhost
  auto_open: true

# Multi-agent config
agents:
  claude_code:
    enabled: true
    name: "Claude Code"
    session_paths:
      - ~/.claude/projects/
    instruction_file: CLAUDE.md            # file CLL quản lý rules
    skills_dir: ~/.claude/skills/
  codex:
    enabled: false                         # bật khi dùng Codex
    name: "OpenAI Codex"
    session_paths:
      - ~/.codex/sessions/                 # cần verify đúng path
    instruction_file: AGENTS.md
    skills_dir: .agents/skills/

limits:
  claude_md_max_rules: 60
  claude_md_max_words: 2500
  claude_md_warn_rules: 40
  claude_md_warn_words: 1800
  memory_max_edits: 25
  scan_max_improvements: 5
  optimize_max_cleanups: 15

slack:
  enabled: false
  webhook_url: ""

db:
  path: ~/.cll/cll.db

backup:
  dir: ~/.cll/backups
  max_backups: 30
```

### 4.2 Workspace: `<workspace>/.cll/workspace.yaml`

```yaml
workspace:
  name: esspride
  path: /Users/vanhuy/Desktop/esspride

repos:
  - name: mobashop
    path: ./mobashop
    claude_md: ./mobashop/CLAUDE.md
    agents_md: ./mobashop/AGENTS.md        # Codex instructions
    tags: [ec-cube, php, ecommerce]
  - name: lunar-ec
    path: ./lunar-ec
    claude_md: ./lunar-ec/CLAUDE.md
    tags: [laravel, lunar, ecommerce]

context:
  domain: "Japanese e-commerce"
  tech_stack: "PHP, EC-CUBE, Laravel, AWS ECS, GMO PG"
  language: "Vietnamese communication, concise answers"
```

---

## 5. Database Schema

```sql
-- ============================================================
-- Sessions
-- ============================================================
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL,
  repo TEXT,
  agent TEXT NOT NULL DEFAULT 'claude_code',   -- claude_code | codex
  session_path TEXT NOT NULL UNIQUE,
  started_at DATETIME,
  message_count INTEGER,
  correction_count INTEGER DEFAULT 0,
  has_corrections BOOLEAN DEFAULT FALSE,
  analyzed_at DATETIME,
  status TEXT DEFAULT 'pending'
);

-- ============================================================
-- Improvements
-- ============================================================
CREATE TABLE improvements (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  workspace TEXT NOT NULL,
  agent TEXT NOT NULL DEFAULT 'claude_code',
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  what_happened TEXT NOT NULL,
  user_correction TEXT,
  suggested_rule TEXT NOT NULL,
  apply_to TEXT NOT NULL,                      -- claude_md | agents_md | memory
  target_repo TEXT,
  status TEXT DEFAULT 'pending',
  edited_rule TEXT,
  conflict_with TEXT,                          -- JSON: conflicting rule IDs
  reviewed_at DATETIME,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Cleanups (optimizer output)
-- ============================================================
CREATE TABLE cleanups (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  targets TEXT,                                -- JSON array
  current_content TEXT NOT NULL,
  proposed_content TEXT,
  reason TEXT NOT NULL,
  words_saved INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  reviewed_at DATETIME,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Active rules (mirror of CLAUDE.md + AGENTS.md + memory)
-- ============================================================
CREATE TABLE active_rules (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,                        -- claude_md | agents_md | memory
  agent TEXT,                                  -- claude_code | codex | null (both)
  workspace TEXT,
  repo TEXT,
  content TEXT NOT NULL,
  category TEXT,                               -- tag cho grouping
  origin_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_triggered_at DATETIME,
  trigger_count INTEGER DEFAULT 0,
  effectiveness_score REAL,                    -- 0.0-1.0
  status TEXT DEFAULT 'active'
);

-- ============================================================
-- Session annotations (manual notes)
-- ============================================================
CREATE TABLE annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id),
  content TEXT NOT NULL,
  annotation_type TEXT DEFAULT 'note',         -- note | bookmark | issue
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Job runs
-- ============================================================
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  agent_filter TEXT,                           -- null = all agents
  started_at DATETIME,
  completed_at DATETIME,
  status TEXT,
  stats TEXT,                                  -- JSON
  error TEXT
);

-- ============================================================
-- Context snapshots (for trends)
-- ============================================================
CREATE TABLE context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace TEXT NOT NULL,
  repo TEXT,
  agent TEXT,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  instruction_file_rules INTEGER,              -- CLAUDE.md or AGENTS.md
  instruction_file_words INTEGER,
  memory_edits INTEGER,
  total_active_rules INTEGER,
  correction_rate REAL                         -- corrections / total messages
);

-- ============================================================
-- Rule import/export history
-- ============================================================
CREATE TABLE rule_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,                     -- import | export
  format TEXT NOT NULL,                        -- yaml | json
  rule_count INTEGER,
  source_workspace TEXT,
  target_workspace TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_sessions_agent ON sessions(agent, workspace);
CREATE INDEX idx_improvements_status ON improvements(status);
CREATE INDEX idx_improvements_agent ON improvements(agent);
CREATE INDEX idx_cleanups_status ON cleanups(status);
CREATE INDEX idx_rules_source ON active_rules(source, workspace);
CREATE INDEX idx_rules_agent ON active_rules(agent);
CREATE INDEX idx_rules_effectiveness ON active_rules(effectiveness_score);
CREATE INDEX idx_snapshots_workspace ON context_snapshots(workspace, measured_at);
CREATE INDEX idx_annotations_session ON annotations(session_id);
```

---

## 6. API Endpoints

### Core (giữ nguyên từ v3)

```
GET    /api/dashboard
POST   /api/scan                    + GET /api/scan/status (SSE)
GET    /api/improvements            + PATCH /api/improvements/:id
POST   /api/optimize                + GET /api/optimize/status (SSE)
POST   /api/apply                   + POST /api/apply/dry-run
GET    /api/rules                   + POST/DELETE /api/rules/:id
GET    /api/sessions                + GET /api/sessions/:id
GET    /api/stats
GET    /api/config                  + PATCH /api/config
GET    /api/rollback/snapshots      + POST /api/rollback
```

### Mới: Agents

```
GET /api/agents
→ [
    {
      id: "claude_code",
      name: "Claude Code",
      enabled: true,
      session_count: 87,
      instruction_file: "CLAUDE.md",
      last_session: "2026-03-23T10:00:00Z",
      correction_rate: 0.12,
      top_categories: ["overcomplicated", "hallucination"]
    },
    {
      id: "codex",
      name: "OpenAI Codex",
      enabled: true,
      session_count: 23,
      instruction_file: "AGENTS.md",
      ...
    }
  ]

PATCH /api/agents/:id
Body: { enabled: true, session_paths: [...] }

GET /api/agents/:id/stats
→ { correction_rate_trend, issues_by_category, comparison_with_other_agents }
```

### Mới: Workspaces

```
GET /api/workspaces
→ [{ name, path, repos: [...], last_scan, rule_count }]

POST /api/workspaces
Body: { name, path }

DELETE /api/workspaces/:name

PATCH /api/workspaces/:name
Body: { repos: [...] }

POST /api/workspaces/:name/scan-repos
→ { discovered_repos: [...] }   # auto-detect repos
```

### Mới: Annotations

```
GET /api/sessions/:id/annotations
POST /api/sessions/:id/annotations
Body: { content: "Note text", type: "note" | "bookmark" | "issue" }
DELETE /api/annotations/:id
```

### Mới: Import/Export

```
GET /api/rules/export?format=yaml&workspace=esspride
→ YAML file download

POST /api/rules/import
Body: multipart (YAML/JSON file)
→ { imported: 5, skipped_duplicates: 2, conflicts: 1 }
```

---

## 7. Web UI: Key Screens

### 7.1 Dashboard

(Giữ nguyên từ v3 + thêm)

Thêm trên dashboard:
- **Learning Velocity widget**: mini chart correction rate trend (7 ngày)
- **Agent summary**: icons cho mỗi agent enabled, session count hôm nay
- **Pending conflicts badge**: nếu có conflict detection

### 7.2 Agent Settings Page

```
┌──────────────────────────────────────────────────────────────────┐
│  🤖 Agents                                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ Claude Code ────────────────────────────────────────────┐    │
│  │  Status: ✅ Enabled                      [Toggle]         │    │
│  │                                                           │    │
│  │  Session paths:                                           │    │
│  │  └─ ~/.claude/projects/                  [Edit] [+ Add]   │    │
│  │                                                           │    │
│  │  Instruction file: CLAUDE.md                              │    │
│  │  Skills dir: ~/.claude/skills/                            │    │
│  │                                                           │    │
│  │  Stats (30d):                                             │    │
│  │  87 sessions · 15 issues · correction rate 12% (↓3%)     │    │
│  │                                                           │    │
│  │  Top issues: overcomplicated (35%) · hallucination (22%) │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ OpenAI Codex ───────────────────────────────────────────┐    │
│  │  Status: ⚪ Disabled                     [Toggle]         │    │
│  │                                                           │    │
│  │  Session paths:                                           │    │
│  │  └─ ~/.codex/sessions/                   [Edit] [+ Add]   │    │
│  │                                                           │    │
│  │  Instruction file: AGENTS.md                              │    │
│  │  Skills dir: .agents/skills/                              │    │
│  │                                                           │    │
│  │  [Enable to start collecting Codex sessions]              │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ Agent Comparison (30d) ─────────────────────────────────┐    │
│  │  (Recharts grouped bar chart)                             │    │
│  │                                                           │    │
│  │  Correction Rate:  Claude 12%  │  Codex 18%              │    │
│  │  Issues Found:     Claude 15   │  Codex 8                │    │
│  │  Top Issue:        overcompl.  │  hallucination           │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Session View + Annotations

```
┌─ Session: mobashop/abc123 ─────────────────────────────────────┐
│  Agent: 🤖 Claude Code  ·  Repo: mobashop  ·  Mar 23, 10:30    │
│  Messages: 12  ·  Corrections: 2  ·  Duration: 25 min          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ 👤 User ────────────────────────────────────────────────┐   │
│  │ GitNexus MCP có hỗ trợ Codex không?                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ 🤖 Claude ──────────────────────────────────────────────┐   │
│  │ Có, GitNexus MCP hỗ trợ Codex thông qua plugin system... │   │
│  │ ⚠️ HALLUCINATION DETECTED                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ 👤 User ────────────────────────────────────────────────┐   │
│  │ Sai. Đọc docs trước đi, đừng bịa.                        │   │
│  │ 📝 CORRECTION                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ═══ Annotations ═══════════════════════════════════════════    │
│                                                                  │
│  📌 Note (Mar 23, 14:00):                                       │
│  "Pattern lặp lại: Claude hay đoán về MCP features.             │
│   Cần strengthen rule về đọc docs trước."                        │
│                                                                  │
│  [➕ Add Note]  [🔖 Bookmark]  [🐛 Flag Issue]                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Rules Import/Export

```
┌─ Import / Export Rules ─────────────────────────────────────────┐
│                                                                  │
│  ┌─ Export ─────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Workspace: [esspride ▾]   Format: [YAML ▾]             │   │
│  │  Include:  ☑ CLAUDE.md rules  ☑ Memory  ☐ Retired       │   │
│  │                                                          │   │
│  │  [📥 Export 42 rules]                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Import ─────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌─ Drop YAML/JSON file here ─────────────────────────┐ │   │
│  │  │                  📁 or click to browse               │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  Preview: (after upload)                                 │   │
│  │  • 5 rules to import                                     │   │
│  │  • 2 duplicates (will skip)                              │   │
│  │  • 1 conflict detected ⚠️                                │   │
│  │                                                          │   │
│  │  [📤 Import]                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Transfer History ───────────────────────────────────────┐   │
│  │  Mar 20  Export  42 rules  YAML  esspride → file         │   │
│  │  Mar 15  Import  8 rules   JSON  file → esspride         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 Workspace Manager

```
┌─ Workspaces ────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─ esspride ★ (active) ───────────────────────────────────┐   │
│  │  Path: /Users/vanhuy/Desktop/esspride                    │   │
│  │  Repos: mobashop · lunar-ec · infra                      │   │
│  │  Rules: 42 · Last scan: 2h ago                           │   │
│  │  [⚙️ Settings] [🔍 Scan Repos]                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ personal ──────────────────────────────────────────────┐    │
│  │  Path: /Users/vanhuy/personal                            │   │
│  │  Repos: blog · tools                                     │   │
│  │  Rules: 8 · Last scan: 5 days ago                        │   │
│  │  [⚙️ Settings] [★ Set Active]                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [➕ Add Workspace]                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.6 Stats: Learning Velocity

```
┌─ Learning Velocity ─────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Correction Rate Trend ──────────────────────────────────┐   │
│  │  (Recharts area chart)                                    │   │
│  │                                                           │   │
│  │  20% ╭─╮                                                  │   │
│  │      │ ╰─╮                                                │   │
│  │  15% │   ╰──╮                                             │   │
│  │      │      ╰──╮        ╭╮                                │   │
│  │  10% │         ╰────────╯╰──                              │   │
│  │   5%                                                       │   │
│  │      W1   W2   W3   W4   W5   W6   W7   W8               │   │
│  │                                                           │   │
│  │  ↓ 8% improvement over 8 weeks                            │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Category Shift ─────────────────────────────────────────┐   │
│  │  (Recharts stacked bar)                                   │   │
│  │                                                           │   │
│  │  Week 1:  ████ halluc  ██████ overcompl  ██ style         │   │
│  │  Week 4:  ██ halluc    ████ overcompl    ████ style       │   │
│  │  Week 8:  █ halluc     ██ overcompl      ███ style        │   │
│  │                                                           │   │
│  │  ✅ Hallucination issues down 70% since rules added       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Rule Effectiveness Ranking ─────────────────────────────┐   │
│  │  Rule                              Score  Issues ↓        │   │
│  │  "MCP: đọc docs trước"            100%   -3 issues       │   │
│  │  "Native solution first"           85%   -5 issues       │   │
│  │  "GMO PG: check docs"              80%   -2 issues       │   │
│  │  "Concise answers"                 50%   -1 issue        │   │
│  │  "WordPress slug"                   0%   no change ⚠️     │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Conflict Detection Flow

Khi analyzer đề xuất rule mới, trước khi vào review queue:

```
1. Lấy suggested_rule
2. Gọi Claude: "So sánh rule mới với existing rules, tìm mâu thuẫn"
3. Nếu conflict → set improvement.conflict_with = [rule_ids]
4. Trong Review UI:

   ┌─ ⚠️ Conflict Detected ──────────────────────────────────┐
   │                                                           │
   │  New rule:                                                │
   │  "Luôn dùng TypeScript strict mode"                       │
   │                                                           │
   │  Conflicts with:                                          │
   │  Rule #15: "Dùng JavaScript cho quick scripts"            │
   │                                                           │
   │  Options:                                                 │
   │  [1] Keep both (they apply to different contexts)         │
   │  [2] Replace old rule with new                            │
   │  [3] Merge into one rule                                  │
   │  [4] Skip new rule                                        │
   │                                                           │
   └───────────────────────────────────────────────────────────┘
```

---

## 9. CLI Commands

```bash
# Primary
cll                                    # Start server + open browser
cll --port 4000
cll --no-open

# Scan + Analyze
cll scan                               # Collect + analyze all agents
cll scan --agent claude_code           # Chỉ scan Claude Code sessions
cll scan --agent codex                 # Chỉ scan Codex sessions
cll scan --since 7d --repo mobashop

# Review + Apply
cll status                             # Quick status
cll status --json
cll apply --dry-run
cll apply

# Rules management
cll rules list
cll rules add "Rule text" --target claude_md --repo mobashop
cll rules export --format yaml > rules.yaml
cll rules import rules.yaml
cll rules search "GMO PG"

# Workspace
cll workspace list
cll workspace init
cll workspace add-repo <path>
cll workspace switch <name>

# Utilities
cll rollback
cll rollback --list
cll doctor
cll init
```

---

## 10. CLAUDE.md / AGENTS.md Apply Convention

### CLAUDE.md (Claude Code)
```markdown
# CLAUDE.md
... user rules ...

## CLL Learning Rules
<!-- Managed by Claude Learning Loop -->
<!-- Updated: 2026-03-23T14:30:00 | Rules: 12 | Words: 287 -->
- Không đoán về MCP server capabilities. Luôn đọc docs/help trước.
- EC-CUBE payment: luôn check GMO PG docs, không assume response format.
```

### AGENTS.md (Codex)
```markdown
# AGENTS.md
... user rules ...

## CLL Learning Rules
<!-- Managed by Claude Learning Loop -->
<!-- Updated: 2026-03-23T14:30:00 | Rules: 8 | Words: 195 -->
- Đọc toàn bộ context trong AGENTS.md trước khi thực hiện task.
- Không tự ý commit, push, hoặc chạy destructive commands.
```

---

## 11. Implementation Phases

### Phase 1 — Foundation (Tuần 1)

| Task | Effort |
|------|--------|
| Monorepo setup (pnpm + Turborepo) | 2h |
| Shared types + Zod schemas (including agent types) | 4h |
| SQLite DB + full schema + queries | 4h |
| Config system (YAML + agent config) | 3h |
| Claude CLI wrapper | 2h |
| Express server skeleton + CORS + SSE helper | 3h |
| Vite + React + Tailwind + shadcn setup | 3h |
| Layout (Sidebar + Header + Router) | 3h |
| CLI entry (`cll` command, start server, open browser) | 2h |
| `cll doctor` + `cll init` + `cll workspace init` | 3h |
| **Subtotal** | **29h** |

**Deliverable:** `cll` mở browser, empty dashboard, config hoạt động.

### Phase 2 — Collector + Analyzer (Tuần 2)

| Task | Effort |
|------|--------|
| Collector: Claude Code session parser | 5h |
| Collector: Codex session parser | 4h |
| Collector: correction detector | 3h |
| Collector: repo scanner | 2h |
| Analyzer: prompts + orchestrator | 5h |
| Analyzer: classifier + dedup | 3h |
| Conflict detector | 3h |
| API: `/api/scan` + SSE, `/api/dashboard` | 3h |
| Web: Dashboard (health bars, activity, velocity mini chart) | 5h |
| Web: Scan page (trigger, progress, results) | 3h |
| **Subtotal** | **36h** |

**Deliverable:** Scan hoạt động, dashboard hiện stats, conflict detection ready.

### Phase 3 — Review + Apply (Tuần 3)

| Task | Effort |
|------|--------|
| API: improvements CRUD, sessions detail | 4h |
| API: apply + dry-run | 3h |
| Applier: CLAUDE.md + AGENTS.md read/write | 4h |
| Applier: memory formatter | 2h |
| Applier: backup/snapshot | 2h |
| Web: Review Queue page | 4h |
| Web: Review Item (approve/edit/skip/conflict) | 5h |
| Web: Session Viewer (slide-over) + correction highlights | 4h |
| Web: Apply confirmation + diff modal + copy-to-clipboard | 3h |
| **Subtotal** | **31h** |

**Deliverable:** **MVP complete** — scan → review → apply trên web.

### Phase 4 — Optimize + Rules + Stats (Tuần 4)

| Task | Effort |
|------|--------|
| Optimizer: 5 passes (merge/rewrite/promote/retire/budget) | 6h |
| Optimizer: budget checker + context scorer | 3h |
| API: optimize + SSE, rules CRUD, stats, rollback | 5h |
| Web: Optimize page (cleanup cards, merge preview, savings) | 4h |
| Web: Rules browser + search + effectiveness score | 4h |
| Web: Stats page (Recharts: budget, issues, category, velocity) | 5h |
| Web: Rollback UI | 2h |
| **Subtotal** | **29h** |

**Deliverable:** Full optimization + analytics.

### Phase 5 — Multi-agent + Workspace + Import/Export (Tuần 5)

| Task | Effort |
|------|--------|
| API: agents CRUD + stats | 3h |
| API: workspaces CRUD + auto-detect repos | 3h |
| API: import/export rules | 3h |
| API: annotations CRUD | 2h |
| Web: Agents page (config, toggle, comparison chart) | 5h |
| Web: Workspaces page (manage, switch, scan repos) | 4h |
| Web: Import/Export UI (drag-drop, preview, history) | 4h |
| Web: Session annotations panel | 3h |
| Web: Agent badge + filter throughout UI | 2h |
| **Subtotal** | **29h** |

**Deliverable:** Multi-agent, multi-workspace, import/export.

### Phase 6 — Polish (Tuần 6)

| Task | Effort |
|------|--------|
| Slack webhook integration | 2h |
| Rule effectiveness tracking (cross-reference scans) | 4h |
| Learning velocity metrics computation | 3h |
| CLI non-interactive commands (scan, status, apply, rules) | 4h |
| Git auto-commit on apply (optional toggle) | 2h |
| Dark mode / theme toggle | 2h |
| Error handling + edge cases | 4h |
| README + documentation | 3h |
| Testing (unit + integration) | 6h |
| **Subtotal** | **30h** |

---

## 12. Tổng ước tính

| Phase | Effort | Cumulative | Deliverable |
|-------|--------|------------|-------------|
| Phase 1: Foundation | 29h | 29h | Empty dashboard, config |
| Phase 2: Collect + Analyze | 36h | 65h | Scan hoạt động |
| Phase 3: Review + Apply | 31h | 96h | **MVP complete** |
| Phase 4: Optimize + Stats | 29h | 125h | Full loop + analytics |
| Phase 5: Multi-agent + WS | 29h | 154h | Multi-agent, import/export |
| Phase 6: Polish | 30h | 184h | Production-ready |

**MVP (Phase 1-3): ~96h**
**Full system: ~184h**

---

## 13. Đánh giá tổng thể & Bổ sung

### ✅ Những gì đã cover tốt

1. **Core loop hoàn chỉnh**: Collect → Analyze → Review → Apply → Optimize
2. **Multi-agent**: Claude Code + Codex, mỗi agent có instruction file riêng
3. **Multi-workspace**: Switch giữa các workspace, mỗi máy config path riêng
4. **Safety**: Backup trước apply, dry-run, rollback, conflict detection
5. **Metrics**: Effectiveness tracking, learning velocity, budget monitoring
6. **Portability**: GitHub repo, gitignored DB/config, workspace path per machine

### ⚠️ Những gì nên bổ sung thêm

#### 13.1 Codex Session Format Research (P0 — cần làm trước Phase 2)

Hiện tại chưa verify chính xác Codex lưu sessions ở đâu và format gì.
Cần research trước khi implement parser.

**Action:** Trước Phase 2, check:
- `~/.codex/` directory structure
- Session file format (JSONL? JSON? other?)
- Có API/CLI export sessions không?

#### 13.2 Rate Limiting cho Claude CLI calls (P1)

`claude -p` dùng chung subscription quota. Nếu scan 50 sessions, batch thành 3 calls
thay vì 50 calls. Đã có trong design, nhưng cần enforce hard:

```yaml
claude:
  max_calls_per_scan: 5          # tối đa 5 claude calls mỗi lần scan
  max_calls_per_optimize: 3      # tối đa 3 calls cho optimize
  batch_size: 5                  # gộp 5 sessions vào 1 prompt
```

#### 13.3 Graceful Degradation khi Claude CLI không available (P1)

Máy nào chưa cài Claude Code → CLL vẫn chạy được ở read-only mode:
- Xem dashboard, rules, stats
- Import rules manually
- Không thể scan/analyze

#### 13.4 Session Privacy (P1)

Sessions có thể chứa sensitive data (API keys, passwords trong code).
Collector nên có option:

```yaml
privacy:
  redact_patterns:
    - "(?i)(api.?key|secret|password|token)\\s*[:=]\\s*\\S+"
  exclude_repos: [secret-project]
```

#### 13.5 Prompt Versioning (P2)

Analyzer/Optimizer prompts sẽ improve theo thời gian.
Lưu prompt version trong DB để biết kết quả nào dùng prompt nào:

```sql
ALTER TABLE runs ADD COLUMN prompt_version TEXT;
```

#### 13.6 Notification khi mở CLL (P2)

Khi `cll` start, check nếu có pending items > 3 ngày → hiện banner:

```
⚠️ 5 pending improvements waiting 3+ days. Review now?
```

#### 13.7 AI Summary cho Review (P2)

Trước khi review, tạo 1 summary:
"Hôm nay có 4 issues, chủ yếu Claude bị overcomplicated (3/4).
Pattern: Claude hay đề xuất custom wrapper thay vì native solution.
Recommend: Strengthen rule about native-first."

Hiện trên Review Queue page header.

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude Code session format thay đổi | Collector break | Adapter pattern, version detect |
| Codex session format unknown | Parser sai | Research trước Phase 2, abstract source interface |
| `claude -p` chậm (2-3s/call) | Scan mất lâu | Batch sessions, SSE progress, limit calls |
| Claude quota bị hết giữa scan | Scan incomplete | Rate limit config, partial results, retry |
| CLAUDE.md phình quá | Phản tác dụng | Hard limit + optimizer + budget alerts |
| False positive rules | Rules gây hại | Human review, conflict detect, rollback |
| Port conflict | Server không start | Config port, auto-increment fallback |
| Sensitive data trong sessions | Privacy leak | Redaction patterns, exclude repos |
| Prompts không tối ưu | Rules chất lượng thấp | Prompt versioning, A/B test |

---

## 15. Success Metrics

| Metric | Target (3 tháng) |
|--------|-------------------|
| Correction rate (user sửa AI) | Giảm 40% |
| CLAUDE.md size | Ổn định 35-50 rules |
| Rule effectiveness (active sau 30 ngày) | > 70% |
| Review time per batch | < 5 phút |
| Context budget usage | 60-80% |
| Scan coverage (sessions analyzed / total) | > 90% |
| Agent comparison: Claude vs Codex correction rate | Track trend |
