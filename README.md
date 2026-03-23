# Agent Learning Loop

Automatically learns from your Claude Code sessions and improves your `~/.claude/CLAUDE.md`.

## How it works

1. **Scan** — Reads session files from `~/.claude/projects/`
2. **Analyze** — Claude analyzes the full session (including tool calls), detecting anti-patterns, process errors, and wrong assumptions
3. **Review** — You approve, edit, or skip each suggestion in the web UI
4. **Apply** — Approved rules are written to `~/.claude/CLAUDE.md`

Unlike heuristic keyword matching, the system sends the **full session narrative** (including tool calls) to Claude for analysis — enabling detection of subtle issues with no explicit user correction.

## Setup

```bash
pnpm install
pnpm build
node cli/dist/index.js serve
```

Open `http://localhost:3939`

## CLI

```bash
# Start the web UI
node cli/dist/index.js serve

# Check system health
node cli/dist/index.js doctor

# Run a scan directly (no UI)
node cli/dist/index.js scan

# Show status
node cli/dist/index.js status
```

## Configuration

File: `~/.cll/config.yaml`

```yaml
port: 3939
claude:
  model: claude-opus-4-6
  maxBatchSize: 3
  maxCallsPerScan: 5
scan:
  maxSessionAge: 30  # days
```

## Architecture

```
agent-learning-loop/
├── cli/              # Commander.js CLI
├── packages/
│   ├── shared/       # TypeScript types, Zod schemas, constants
│   ├── server/       # Express API + SQLite + scan/analyze/apply pipeline
│   └── web/          # React + Tailwind + shadcn/ui frontend
└── config/           # Default config
```

### Session tracking

- Sessions are tracked by file path — already-analyzed sessions are never re-scanned
- Resumed sessions (messages appended to the same file) are auto-detected via file mtime; only the new tail is analyzed
- Sessions with fewer than 3 user messages are skipped

### Applying rules

Rules are written to `~/.claude/CLAUDE.md` inside a `<!-- CLL:START -->` / `<!-- CLL:END -->` block. Your manually written content is never touched.
