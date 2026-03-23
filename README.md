# Claude Learning Loop (CLL) v5

Automatically learns from your Claude Code sessions and improves your CLAUDE.md.

## How It Works

1. **Scan** — Reads your Claude Code session files (~/.claude/projects/)
2. **Detect** — Identifies moments where you corrected Claude's behavior
3. **Analyze** — Claude analyzes corrections and suggests behavioral rules
4. **Review** — You approve, edit, or skip suggestions in the web UI
5. **Apply** — Approved rules are added to your project's CLAUDE.md

## Installation

```bash
# Clone and install
cd agent-learning-loop
pnpm install

# Build
pnpm build

# Run
npx tsx cli/index.ts
```

## Usage

```bash
# Start web UI (opens browser)
npx tsx cli/index.ts

# Check system health
npx tsx cli/index.ts doctor

# Scan sessions
npx tsx cli/index.ts scan

# View status
npx tsx cli/index.ts status

# Manage rules
npx tsx cli/index.ts rules list
```

## Architecture

- **packages/shared** — TypeScript types, Zod schemas, constants
- **packages/server** — Express 5 API server with SQLite
- **packages/web** — React 19 + Tailwind 4 + shadcn/ui frontend
- **cli/** — Commander.js CLI tool

## Configuration

Config file: `~/.cll/config.yaml`

```yaml
port: 3939
claude:
  model: claude-opus-4-5
  maxBatchSize: 5
scan:
  maxSessionAge: 30  # days
analysis:
  heuristicThreshold: 0.6
```

## Extension Points

CLL v5 is designed to be extensible:
- `SessionSource` interface → add Codex support (~14h)
- `InstructionTarget` interface → write to AGENTS.md or memory files
