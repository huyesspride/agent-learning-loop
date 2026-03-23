# Claude Learning Loop (CLL) v5 — Updated Plan

> Focus: Claude Code only cho MVP, architecture extensible để bổ sung Codex sau.
> Giảm scope, realistic estimates, test-first cho critical paths.

---

## Context

Plan v4 có scope quá rộng (184h, 11 pages, multi-agent từ đầu). Sau review, cần:
- Cắt Codex khỏi MVP — chưa biết session format, implement sau khi research
- Giảm UI từ 11 pages → 4 pages
- Thêm heuristic correction detection để giảm Claude API calls
- Test-first cho 3 critical paths: session parser, correction detector, CLAUDE.md writer
- Giữ abstract interfaces để Codex pluggable sau (~14h effort khi thêm)

---

## 1. Kiến trúc

```
Browser (localhost:3939)
  React 19 SPA + Tailwind CSS 4 + shadcn/ui
         │
         │ REST API + SSE
         ↓
Express 5 Server (:3939)
  ├── Routes (18 endpoints, giảm từ 28+)
  ├── Core Engine
  │   ├── SessionSource interface    ← Extension point cho agents
  │   │   └── ClaudeCodeSource       ← Chỉ implement này cho MVP
  │   ├── CorrectionDetector
  │   │   ├── HeuristicDetector      ← Pattern matching (0 API calls)
  │   │   └── ClaudeAnalyzer         ← Deep analysis (batched)
  │   ├── Optimizer
  │   └── Applier
  │       ├── InstructionTarget interface  ← Extension point
  │       ├── ClaudeMdTarget         ← MVP
  │       ├── MemoryTarget
  │       └── BackupManager
  ├── Claude CLI wrapper (child_process)
  ├── SQLite DB (better-sqlite3)
  └── Config (YAML)
```

---

## 2. Extension Points (cho Codex sau)

### SessionSource Interface
```typescript
interface SessionSource {
  readonly id: string;                    // 'claude_code' | 'codex'
  readonly name: string;
  readonly instructionFileName: string;   // 'CLAUDE.md' | 'AGENTS.md'
  collectSessions(options: CollectOptions): Promise<RawSession[]>;
  getInstructionFilePath(projectPath: string): string;
  isAvailable(): Promise<boolean>;
}
```

### InstructionTarget Interface
```typescript
interface InstructionTarget {
  readonly type: string;      // 'claude_md' | 'agents_md' | 'memory'
  read(filePath: string): Promise<InstructionFile>;
  write(filePath: string, content: InstructionFile, options: WriteOptions): Promise<void>;
  validate(content: InstructionFile): ValidationResult;
}
```

### SourceRegistry
```typescript
class SourceRegistry {
  register(source: SessionSource): void;
  get(id: string): SessionSource | undefined;
  getEnabled(): SessionSource[];
}
```

MVP chỉ register `ClaudeCodeSource`. Thêm Codex = implement interface + register.

---

## 3. Claude Code Session Format (đã verify)

- **Location:** `~/.claude/projects/{encoded-path}/{session-uuid}.jsonl`
  - Encoding: `/Users/foo/project` → `-Users-foo-project`
- **JSONL format:** Mỗi dòng là JSON với:
  - `type`: "user" | "assistant" | "progress" | "queue-operation" | "system" | "file-history-snapshot"
  - `message.content`: string hoặc array of `{type: "text"|"thinking"|"tool_use"|"tool_result", ...}`
  - `timestamp`, `sessionId`, `version`
- **Session metadata:** `~/.claude/sessions/{pid}.json` → `{pid, sessionId, cwd, startedAt}`
- **Subagents:** `{session-uuid}/subagents/agent-{id}.jsonl` + `.meta.json`

---

## 4. Heuristic Correction Detection

Giảm ~60-70% Claude API calls bằng pattern matching trước khi gọi Claude.

**Vietnamese patterns (high confidence):**
- `sai rồi`, `không đúng`, `sửa lại`, `làm lại`, `không phải vậy`
- `đừng`, `bịa`, `đoán`, `đọc docs`, `check docs`

**English patterns (medium confidence):**
- `no,`, `wrong`, `incorrect`, `don't`, `stop`, `fix this`, `try again`

**Behavioral patterns (lower confidence):**
- User message rất ngắn (<20 chars) sau assistant message dài
- User gửi cùng request 2 lần trong 3 messages
- `[Request interrupted by user]`

**Skip messages:** `<command-message>`, `<task-notification>`, `tool_result`, context continuation

**Algorithm:** confidence > 0.6 → mark as correction. Session có correction → gửi Claude analyze. Session không có → skip (status='skipped').

---

## 5. Database Schema (simplified, extensible)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL DEFAULT 'claude_code',  -- extensible
  project_path TEXT NOT NULL,
  session_path TEXT NOT NULL UNIQUE,
  started_at DATETIME,
  message_count INTEGER DEFAULT 0,
  user_message_count INTEGER DEFAULT 0,
  correction_count INTEGER DEFAULT 0,
  analyzed_at DATETIME,
  status TEXT DEFAULT 'pending',  -- pending | analyzed | skipped
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE improvements (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  source_id TEXT NOT NULL DEFAULT 'claude_code',
  category TEXT NOT NULL,
  severity TEXT NOT NULL,     -- high | medium | low
  what_happened TEXT NOT NULL,
  user_correction TEXT,
  suggested_rule TEXT NOT NULL,
  apply_to TEXT NOT NULL DEFAULT 'claude_md',
  status TEXT DEFAULT 'pending',  -- pending | approved | edited | skipped | applied
  edited_rule TEXT,
  conflict_with TEXT,         -- JSON array of rule IDs
  reviewed_at DATETIME,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE active_rules (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  target TEXT NOT NULL,       -- claude_md | memory
  project_path TEXT,
  content TEXT NOT NULL,
  category TEXT,
  origin_improvement_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  effectiveness_score REAL,
  effectiveness_baseline_rate REAL,
  effectiveness_sample_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'  -- active | retired
);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,     -- scan | optimize
  started_at DATETIME,
  completed_at DATETIME,
  status TEXT,
  stats TEXT,                 -- JSON
  error TEXT,
  prompt_version TEXT
);

CREATE TABLE context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL DEFAULT 'claude_code',
  project_path TEXT,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  instruction_file_rules INTEGER,
  instruction_file_words INTEGER,
  total_active_rules INTEGER,
  correction_rate REAL
);

CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  backup_type TEXT NOT NULL,  -- pre_apply | manual
  run_id INTEGER REFERENCES runs(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

`source_id` trên tất cả tables → thêm Codex không cần migrate schema.

---

## 6. API Endpoints (18, giảm từ 28+)

```
GET    /api/dashboard
POST   /api/scan                    + GET /api/scan/status (SSE)
GET    /api/improvements            + PATCH /api/improvements/:id
POST   /api/apply                   + POST /api/apply/dry-run
GET    /api/rules                   + POST/PATCH/DELETE /api/rules/:id
GET    /api/sessions                + GET /api/sessions/:id
GET    /api/stats                   + GET /api/stats/effectiveness
POST   /api/optimize                + GET /api/optimize/status (SSE)
GET    /api/config                  + PATCH /api/config
GET    /api/rollback/snapshots      + POST /api/rollback
```

Bỏ: agents CRUD, workspaces CRUD, annotations, import/export.

---

## 7. UI Pages (4, giảm từ 11)

| Page | Mô tả |
|------|--------|
| **Dashboard** | Stats cards, correction trend chart, recent activity, quick actions |
| **Scan+Review** | Scan trigger + SSE progress + review queue + approve/edit/skip + apply + dry-run diff |
| **Rules** | Rules browser + search + effectiveness bars + add/edit + optimizer trigger |
| **Settings** | Config editor + rollback list + doctor status |

---

## 8. CLAUDE.md Apply Convention

```markdown
# Project Rules
(User's rules - CLL KHÔNG BAO GIỜ sửa phần này)

## CLL Learning Rules
<!-- CLL:START - Managed by Claude Learning Loop - DO NOT EDIT -->
<!-- Updated: 2026-03-23T14:30:00 | Rules: 12 | Words: 287 | Version: v5 -->
- Không đoán về MCP server capabilities. Luôn đọc docs/help trước.
- EC-CUBE payment: luôn check GMO PG docs, không assume response format.
<!-- CLL:END -->
```

`CLL:START` / `CLL:END` markers cho reliable parsing. User content trên markers không bao giờ bị sửa.

---

## 9. Rule Effectiveness Algorithm

```
1. Khi thêm rule cho category X:
   baseline_rate = correction_rate category X (10 sessions gần nhất trước khi thêm)

2. Sau mỗi scan:
   current_rate = corrections category X / sessions kể từ khi thêm rule
   effectiveness = (baseline - current) / baseline
   Clamp [0.0, 1.0]

3. Hiển thị:
   sample_count < 5 → "Chưa đủ data"
   score == 0 sau 10+ sessions → candidate for retirement
```

---

## 10. Scan Pipeline

```
POST /api/scan
  │
  ├── 1. COLLECT (0 API calls)
  │     ClaudeCodeSource.collectSessions()
  │     Filter out already-analyzed sessions
  │     SSE: { phase: 'collect', total: N }
  │
  ├── 2. HEURISTIC DETECT (0 API calls)
  │     HeuristicDetector.detect(messages)
  │     Partition: withCorrections / noCorrections
  │     Store noCorrections as status='skipped'
  │     SSE: { phase: 'detect', withCorrections: M, skipped: N-M }
  │
  ├── 3. ANALYZE (batched Claude API calls)
  │     Batch sessions (5/call, max 5 calls/scan)
  │     Claude: categorize + suggest rules
  │     ConflictDetector.check() each suggestion
  │     Store improvements
  │     SSE: { phase: 'analyze', batch: i/total }
  │
  └── 4. COMPLETE
        Record run, take context_snapshot
        SSE: { phase: 'complete', improvements: N }
```

---

## 11. Project Structure

```
claude-learning-loop/
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/src/
│   │   ├── types/          # session, correction, improvement, rule, config, api
│   │   ├── schemas.ts      # Zod schemas
│   │   └── constants.ts
│   ├── server/src/
│   │   ├── index.ts
│   │   ├── routes/         # 9 route files
│   │   ├── core/
│   │   │   ├── sources/    # session-source.ts, claude-code.ts
│   │   │   ├── detection/  # heuristic-detector.ts, patterns.ts
│   │   │   ├── analyzer/   # index.ts, prompts.ts, conflict-detector.ts
│   │   │   ├── optimizer/  # index.ts, prompts.ts
│   │   │   ├── applier/    # instruction-target.ts, claude-md.ts, memory.ts, backup.ts
│   │   │   └── effectiveness/tracker.ts
│   │   ├── claude/client.ts
│   │   ├── db/             # schema.sql, queries/, migrations.ts
│   │   ├── config/         # loader.ts, defaults.ts
│   │   └── utils/          # logger.ts, sse.ts, tokens.ts
│   └── web/src/
│       ├── pages/          # Dashboard, ScanReview, Rules, Settings (4 pages)
│       ├── components/     # layout/, dashboard/, scan/, review/, rules/, shared/
│       ├── hooks/          # useApi, useScan, useSSE
│       └── lib/            # api.ts, utils.ts
├── cli/index.ts
└── config/default.yaml
```

~45 files (giảm từ ~60).

---

## 12. Implementation Phases

### Phase 1 — Foundation + Session Parser (Tuần 1) — 36h

| Task | Effort |
|------|--------|
| Monorepo setup (pnpm + Turborepo + tsconfig) | 2h |
| `packages/shared/` types + Zod schemas + constants | 3h |
| SQLite DB + schema.sql + migration runner | 3h |
| Config loader (YAML + defaults + validation) | 2h |
| Express 5 skeleton + CORS + error handler | 2h |
| SSE helper utility | 1h |
| Claude CLI wrapper | 2h |
| Vite + React 19 + Tailwind 4 + shadcn/ui setup | 2h |
| Layout shell (Sidebar + Header + Router) | 2h |
| CLI entry (Commander.js: `cll`, `cll doctor`) | 2h |
| **ClaudeCodeSource: session parser** | 4h |
| **Heuristic correction detector** | 3h |
| **CLAUDE.md reader/writer** | 3h |
| **Unit tests cho parser + detector + writer** | 4h |
| Test fixtures | 1h |

**Deliverable:** `cll` mở browser với empty shell. Parser, detector, writer tested.

### Phase 2 — Core Loop: Scan → Review → Apply (Tuần 2-3) — 54h

| Task | Effort |
|------|--------|
| Scan pipeline orchestrator | 4h |
| Claude analyzer (batch, parse response) | 5h |
| Conflict detector | 3h |
| API: scan + SSE, improvements, apply, dashboard, sessions | 11h |
| Applier orchestrator + backup + memory target | 5h |
| Web: Dashboard page | 4h |
| Web: ScanReview page + components | 10h |
| Web: Apply confirmation + dry-run modal | 3h |
| TanStack Query + API hooks + SSE hooks | 4h |
| Integration tests (scan + apply pipelines) | 5h |

**Deliverable:** **MVP complete** — scan → review → apply trên web.

### Phase 3 — Optimize + Rules + Stats (Tuần 4) — 36h

| Task | Effort |
|------|--------|
| Optimizer (merge/rewrite/retire/budget) + prompts | 7h |
| API: optimize+SSE, rules CRUD, stats, config, rollback | 8h |
| Effectiveness tracker | 3h |
| Web: Rules page + optimizer trigger | 6h |
| Web: Settings page + rollback | 3h |
| Context snapshot recording | 1h |
| Rollback implementation | 2h |
| CLI: `cll scan`, `cll status`, `cll apply`, `cll rules` | 3h |
| Tests | 3h |

**Deliverable:** Full system operational.

### Phase 4 — Polish + Agent Extensibility (Tuần 5) — 27h

| Task | Effort |
|------|--------|
| Finalize interfaces + docs | 4h |
| Research Codex session format | 3h |
| Error handling + edge cases | 4h |
| Dark mode | 2h |
| Rate limiting / retry | 2h |
| Privacy: redaction patterns | 2h |
| README + docs | 3h |
| Additional tests | 3h |
| `cll doctor` complete | 2h |
| Bug fixes buffer | 2h |

**Deliverable:** Production-ready. Clean interfaces for Codex.

---

## 13. Tổng estimate

| Phase | Effort | Cumulative | Deliverable |
|-------|--------|------------|-------------|
| Phase 1: Foundation | 36h | 36h | Tested parser + writer + detector |
| Phase 2: Core Loop | 54h | 90h | **MVP: scan → review → apply** |
| Phase 3: Optimize + Rules | 36h | 126h | Full feature set |
| Phase 4: Polish | 27h | 153h | Production ready |

**MVP: ~90h** | **Full: ~153h** (giảm từ 184h v4)

---

## 14. Thêm Codex sau (~14h)

Khi MVP hoàn tất và muốn thêm Codex:

1. **Research format** (3h): Check `~/.codex/sessions/`, document format
2. **Implement `CodexSource`** (4h): implements `SessionSource` interface
3. **Implement `AgentsMdTarget`** (2h): implements `InstructionTarget` cho AGENTS.md
4. **Codex heuristic patterns** (1h): thêm patterns vào `patterns.ts`
5. **Config + register** (1h): thêm vào YAML config + startup registry
6. **Tests** (3h)

**Không cần thay đổi:** DB schema, API endpoints, UI components (chỉ thêm source badge + filter).

---

## 15. Verification

Sau mỗi phase, verify:
- `pnpm test` — all tests pass
- `pnpm build` — no TypeScript errors
- `cll doctor` — checks Claude CLI, DB, config, paths
- Manual test: `cll` → browser → trigger scan → review → apply → check CLAUDE.md

---

## 16. Critical Files

| File | Vai trò |
|------|---------|
| `packages/shared/src/types/session.ts` | SessionSource interface — mọi module phụ thuộc |
| `packages/server/src/core/sources/claude-code.ts` | JSONL parser — input cho toàn bộ pipeline |
| `packages/server/src/core/detection/heuristic-detector.ts` | Giảm 60-70% API calls |
| `packages/server/src/core/applier/claude-md.ts` | Sửa CLAUDE.md — phải bulletproof |
| `packages/server/src/core/analyzer/prompts.ts` | Claude prompts — quyết định chất lượng rules |
