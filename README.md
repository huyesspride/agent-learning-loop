# Agent Learning Loop

Tự động học từ các session Claude Code và cải thiện `~/.claude/CLAUDE.md` của bạn.

## Cách hoạt động

1. **Scan** — Đọc session files từ `~/.claude/projects/`
2. **Analyze** — Claude phân tích toàn bộ session (bao gồm tool calls), phát hiện anti-pattern, lỗi quy trình, giả định sai
3. **Review** — Bạn approve, edit, hoặc skip từng suggestion trong web UI
4. **Apply** — Rule được approve ghi vào `~/.claude/CLAUDE.md`

Khác với heuristic keyword matching thông thường, hệ thống gửi **full session narrative** (kể cả tool calls) cho Claude để phân tích — nên phát hiện được cả những vấn đề tinh tế không có explicit correction.

## Cài đặt

```bash
pnpm install
pnpm build
node cli/dist/index.js serve
```

Mở `http://localhost:3939`

## CLI

```bash
# Khởi động web UI
node cli/dist/index.js serve

# Kiểm tra system health
node cli/dist/index.js doctor

# Scan trực tiếp (không cần UI)
node cli/dist/index.js scan

# Xem status
node cli/dist/index.js status
```

## Cấu hình

File: `~/.cll/config.yaml`

```yaml
port: 3939
claude:
  model: claude-opus-4-5
  maxBatchSize: 3
  maxCallsPerScan: 5
scan:
  maxSessionAge: 30  # ngày
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

- Sessions được track theo file path — không bao giờ scan lại session đã analyzed
- Resume session (append messages vào cùng file) → tự detect qua file mtime, chỉ analyze phần mới
- Sessions quá ngắn (< 3 user messages) → bỏ qua

### Apply rules

Rules được ghi vào `~/.claude/CLAUDE.md` trong block `<!-- CLL:START -->` / `<!-- CLL:END -->`. Phần content thủ công của bạn không bị đụng chạm.
