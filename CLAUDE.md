# Agent Learning Loop — Project Rules

## Build & Dev

```bash
pnpm install          # install deps
pnpm build            # build tất cả packages
pnpm --filter @cll/server build   # build server only
pnpm --filter @cll/web build      # build web only
node cli/dist/index.js serve      # start server (port 3939)
```

## Architecture

- `cli/` — CLI entry point, commands: serve, scan, doctor, status, rules
- `packages/server/src/core/` — pipeline chính:
  - `scanner.ts` — orchestrate collect → filter → analyze
  - `sources/claude-code.ts` — đọc JSONL session files từ `~/.claude/projects/`
  - `analyzer/` — gửi full session narrative cho Claude API, parse JSON response
  - `applier/` — ghi rules vào `~/.claude/CLAUDE.md`
  - `detection/` — heuristic detector (hiện không dùng làm gate, chỉ reference)
- `packages/server/src/routes/` — Express routes: scan, improvements, rules, apply, config, rollback
- `packages/server/src/db/` — SQLite queries + migrations
- `packages/web/src/` — React frontend, hooks, pages

## Key behaviors

- Apply luôn ghi vào `~/.claude/CLAUDE.md` (global), không phải CLAUDE.md của repo hiện tại
- Sessions track theo `session_path` — skip nếu `analyzed` hoặc `skipped`, retry nếu `pending`
- Resume session: check `file mtime > analyzed_at`, nếu có thì chỉ analyze tail (messages mới)
- Analyzer prompt viết bằng tiếng Việt, output tiếng Việt

## Database

SQLite tại `~/.cll/cll.db`. Tables: sessions, improvements, active_rules, runs, backups, context_snapshots.

Migrations incremental trong `packages/server/src/db/migrations.ts` — safe to re-run.

## Coding style

- TypeScript strict, ESM imports với `.js` extension
- Không dùng ORM — raw better-sqlite3 queries
- snake_case trong DB → camelCase trong API qua mappers (`packages/server/src/utils/mappers.ts`)
- Build trước khi test thủ công (`pnpm build` → `node cli/dist/index.js serve`)
