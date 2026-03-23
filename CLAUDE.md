# Agent Learning Loop — Project Rules

## Build & Dev

```bash
pnpm install                              # install deps
pnpm build                               # build all packages
pnpm --filter @cll/server build          # build server only
pnpm --filter @cll/web build             # build web only
node cli/dist/index.js serve             # start server (port 3939)
```

## Architecture

- `cli/` — CLI entry point, commands: serve, scan, doctor, status, rules
- `packages/server/src/core/` — main pipeline:
  - `scanner.ts` — orchestrates collect → filter → analyze
  - `sources/claude-code.ts` — reads JSONL session files from `~/.claude/projects/`
  - `analyzer/` — sends full session narrative to Claude API, parses JSON response
  - `applier/` — writes rules to `~/.claude/CLAUDE.md`
  - `detection/` — heuristic detector (not used as a gate, kept for reference)
- `packages/server/src/routes/` — Express routes: scan, improvements, rules, apply, config, rollback
- `packages/server/src/db/` — SQLite queries + migrations
- `packages/web/src/` — React frontend, hooks, pages

## Key behaviors

- Apply always writes to `~/.claude/CLAUDE.md` (global), never to the current repo's CLAUDE.md
- Sessions are tracked by `session_path` — skipped if `analyzed` or `skipped`, retried if `pending`
- Resumed sessions: if `file mtime > analyzed_at`, only the new tail (new messages) is analyzed
- Analyzer prompt and output are in Vietnamese

## Database

SQLite at `~/.cll/cll.db`. Tables: sessions, improvements, active_rules, runs, backups, context_snapshots.

Migrations are incremental in `packages/server/src/db/migrations.ts` — safe to re-run.

## Coding style

- TypeScript strict mode, ESM imports with `.js` extension
- No ORM — raw better-sqlite3 queries
- snake_case in DB → camelCase in API via mappers (`packages/server/src/utils/mappers.ts`)
- Build before manual testing (`pnpm build` → `node cli/dist/index.js serve`)
