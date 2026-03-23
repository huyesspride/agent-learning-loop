#!/usr/bin/env node
import { Command } from 'commander';
import { spawn, execFileSync } from 'child_process';
import { createConnection } from 'net';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const program = new Command();

program
  .name('cll')
  .description('Claude Learning Loop — learn from your Claude Code sessions')
  .version('0.1.0');

// Default command: start server + open browser
program
  .command('start', { isDefault: true })
  .description('Start CLL server and open browser')
  .option('--no-browser', 'Do not open browser automatically')
  .action(async (options) => {
    const port = 3939;
    const url = `http://localhost:${port}`;

    // Check if already running
    const running = await isPortOpen(port);
    if (running) {
      console.log(`CLL server already running at ${url}`);
      if (options.browser) {
        await openBrowser(url);
      }
      return;
    }

    // Start server
    console.log('Starting CLL server...');
    const serverPath = join(__dirname, '..', 'packages', 'server', 'dist', 'index.js');

    // Check if built
    if (!existsSync(serverPath)) {
      console.error('Server not built. Run: pnpm build');
      process.exit(1);
    }

    const server = spawn('node', [serverPath], {
      stdio: 'inherit',
      detached: false,
    });

    // Wait for server to be ready
    await waitForPort(port, 10000);

    console.log(`✓ CLL server running at ${url}`);

    if (options.browser) {
      await openBrowser(url);
    }

    // Keep alive until Ctrl+C
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      server.kill('SIGTERM');
      process.exit(0);
    });

    server.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
      process.exit(code ?? 0);
    });
  });

// doctor command
program
  .command('doctor')
  .description('Check CLL system health')
  .action(async () => {
    console.log('CLL Doctor Report');
    console.log('─────────────────');

    const checks = await runDoctorChecks();
    let hasErrors = false;
    let hasWarnings = false;

    for (const check of checks) {
      const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
      console.log(`${icon} ${check.name}: ${check.detail}`);
      if (check.suggestion) console.log(`  → ${check.suggestion}`);
      if (check.status === 'error') hasErrors = true;
      if (check.status === 'warn') hasWarnings = true;
    }

    console.log('');
    if (hasErrors) {
      console.log('Status: ISSUES FOUND — fix errors above');
      process.exit(1);
    } else if (hasWarnings) {
      console.log(`Status: READY (${checks.filter(c => c.status === 'warn').length} warning(s))`);
    } else {
      console.log('Status: READY ✓');
    }
  });

interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
  suggestion?: string;
}

async function runDoctorChecks(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  // 1. Claude CLI
  try {
    const version = execFileSync('claude', ['--version'], { encoding: 'utf-8' }).trim();
    checks.push({ name: 'Claude CLI', status: 'ok', detail: `found (${version})` });
  } catch {
    checks.push({
      name: 'Claude CLI',
      status: 'error',
      detail: 'not found',
      suggestion: 'Install Claude Code: https://claude.ai/code'
    });
  }

  // 2. ~/.claude/ directory
  const claudeDir = join(homedir(), '.claude');
  if (existsSync(claudeDir)) {
    checks.push({ name: 'Claude directory', status: 'ok', detail: claudeDir });
  } else {
    checks.push({
      name: 'Claude directory',
      status: 'warn',
      detail: `${claudeDir} not found`,
      suggestion: 'Start Claude Code CLI first to create session directory'
    });
  }

  // 3. Session files
  const projectsDir = join(homedir(), '.claude', 'projects');
  if (existsSync(projectsDir)) {
    const sessionCount = countSessions(projectsDir);
    checks.push({
      name: 'Session files',
      status: sessionCount > 0 ? 'ok' : 'warn',
      detail: `${sessionCount} sessions found in ${projectsDir}`,
      suggestion: sessionCount === 0 ? 'Use Claude Code CLI to create sessions first' : undefined
    });
  } else {
    checks.push({
      name: 'Session files',
      status: 'warn',
      detail: 'No sessions directory found',
    });
  }

  // 4. Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1));
  checks.push({
    name: 'Node.js',
    status: majorVersion >= 20 ? 'ok' : 'error',
    detail: `${nodeVersion} (need >= 20)`,
    suggestion: majorVersion < 20 ? 'Upgrade Node.js to v20 or later' : undefined
  });

  // 5. Port availability
  const portInUse = await isPortOpen(3939);
  checks.push({
    name: 'Port 3939',
    status: portInUse ? 'warn' : 'ok',
    detail: portInUse ? 'in use (server may already be running)' : 'available',
  });

  // 6. ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) {
    checks.push({ name: 'ANTHROPIC_API_KEY', status: 'ok', detail: 'set' });
  } else {
    checks.push({
      name: 'ANTHROPIC_API_KEY',
      status: 'warn',
      detail: 'not set',
      suggestion: 'Set ANTHROPIC_API_KEY env var for Claude API analysis'
    });
  }

  return checks;
}

function countSessions(projectsDir: string): number {
  let count = 0;
  try {
    for (const dir of readdirSync(projectsDir)) {
      const dirPath = join(projectsDir, dir);
      try {
        const files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
        count += files.length;
      } catch {}
    }
  } catch {}
  return count;
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = createConnection({ port, host: '127.0.0.1' });
    conn.on('connect', () => {
      conn.destroy();
      resolve(true);
    });
    conn.on('error', () => resolve(false));
    conn.setTimeout(500, () => {
      conn.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Server did not start on port ${port} within ${timeoutMs}ms`);
}

function openBrowser(url: string): Promise<void> {
  return new Promise((resolve) => {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
    resolve();
  });
}

program.parse();
