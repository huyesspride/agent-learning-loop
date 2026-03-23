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

  // 6. Claude CLI logged in (CLL dùng Claude Code CLI, không cần ANTHROPIC_API_KEY trực tiếp)
  // Claude CLI tự handle auth — chỉ cần claude CLI đã được install và login

  // 7. Disk space
  try {
    const { execFileSync: execFS } = await import('child_process');
    const output = execFS('df', ['-k', homedir()], { encoding: 'utf-8' });
    const lines = output.split('\n');
    const dataLine = lines[1];
    if (dataLine) {
      const parts = dataLine.trim().split(/\s+/);
      const availableKb = parseInt(parts[3] ?? '0');
      const availableMb = availableKb / 1024;
      checks.push({
        name: 'Disk space',
        status: availableMb > 100 ? 'ok' : 'warn',
        detail: `${availableMb.toFixed(0)}MB available`,
        suggestion: availableMb <= 100 ? 'Low disk space may affect session storage' : undefined,
      });
    }
  } catch {
    checks.push({ name: 'Disk space', status: 'warn', detail: 'Could not check' });
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

// scan command
program
  .command('scan')
  .description('Scan Claude Code sessions for improvements')
  .option('--path <path>', 'Project path to scan')
  .action(async (options) => {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;

    const port = 3939;
    const baseUrl = `http://localhost:${port}`;

    // Start spinner
    const spinner = ora('Starting scan...').start();

    try {
      // POST /api/scan
      const scanRes = await fetch(`${baseUrl}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPaths: options.path ? [options.path] : undefined,
        }),
      });

      if (!scanRes.ok) {
        spinner.fail(`Scan failed: ${scanRes.statusText}`);
        process.exit(1);
      }

      spinner.text = 'Scan in progress...';

      // Connect to SSE for progress
      const { EventSource } = await import('eventsource');
      const es = new EventSource(`${baseUrl}/api/scan/status`);

      await new Promise<void>((resolve, reject) => {
        es.addEventListener('progress', (e: any) => {
          const data = JSON.parse(e.data);

          switch (data.phase) {
            case 'collect':
              spinner.text = `✓ Collected ${data.total} sessions`;
              break;
            case 'detect':
              spinner.text = `✓ Detected ${data.withCorrections} with corrections, ${data.skipped} skipped`;
              break;
            case 'analyze':
              spinner.text = `⟳ Analyzing batch ${data.batch}...`;
              break;
            case 'complete':
              spinner.succeed(chalk.green(
                `Done! Found ${data.improvements} improvement${data.improvements !== 1 ? 's' : ''}`
              ));
              if (data.improvements > 0) {
                console.log(chalk.dim('  Run `cll review` or visit http://localhost:3939/scan to review'));
              }
              resolve();
              break;
            case 'error':
              spinner.fail(`Scan error: ${data.error}`);
              reject(new Error(data.error));
              break;
          }
        });

        es.onerror = () => {
          es.close();
          resolve(); // SSE closed normally
        };

        // Timeout after 5 minutes
        setTimeout(() => {
          es.close();
          resolve();
        }, 5 * 60 * 1000);
      });

      es.close();
    } catch (err) {
      spinner.fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// status command
program
  .command('status')
  .description('Show CLL status and statistics')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const port = 3939;
    const baseUrl = `http://localhost:${port}`;

    try {
      const res = await fetch(`${baseUrl}/api/dashboard`);
      if (!res.ok) {
        console.error(chalk.red(`Server not running. Start with: cll`));
        process.exit(1);
      }

      const data = await res.json() as any;

      console.log(chalk.bold('\nCLL Status'));
      console.log('──────────');
      console.log(`Sessions:      ${chalk.cyan(data.analyzedSessions)} analyzed | ${chalk.yellow(data.pendingSessions ?? 0)} pending`);
      console.log(`Improvements:  ${chalk.yellow(data.pendingImprovements ?? 0)} pending review`);
      console.log(`Active Rules:  ${chalk.cyan(data.appliedRules ?? 0)}`);

      if (data.correctionRate > 0) {
        console.log(`Correction Rate: ${chalk.red((data.correctionRate * 100).toFixed(1) + '%')}`);
      }

      console.log('');

      if ((data.pendingImprovements ?? 0) > 0) {
        console.log(chalk.yellow(`ℹ ${data.pendingImprovements} improvements ready to review`));
        console.log(chalk.dim('  Run `cll apply --all` or visit http://localhost:3939/scan'));
      } else {
        console.log(chalk.green('✓ No pending improvements'));
      }
    } catch (err) {
      console.error(`Failed to connect to CLL server. Is it running? Start with: ${chalk.cyan('cll')}`);
      process.exit(1);
    }
  });

// apply command
program
  .command('apply')
  .description('Apply approved improvements to CLAUDE.md')
  .option('--all', 'Auto-approve and apply all pending improvements')
  .action(async (options) => {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;
    const port = 3939;
    const baseUrl = `http://localhost:${port}`;

    const spinner = ora('Loading improvements...').start();

    try {
      // Get pending improvements
      const res = await fetch(`${baseUrl}/api/improvements?status=approved`);
      const data = await res.json() as any;
      const items = data.items ?? [];

      if (items.length === 0) {
        spinner.info('No approved improvements to apply');
        return;
      }

      if (options.all) {
        // Also get pending and approve them
        const pendingRes = await fetch(`${baseUrl}/api/improvements?status=pending`);
        const pendingData = await pendingRes.json() as any;

        for (const imp of pendingData.items ?? []) {
          await fetch(`${baseUrl}/api/improvements/${imp.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          });
          items.push({ ...imp, status: 'approved' });
        }
      }

      const ids = items.map((i: any) => i.id);
      spinner.text = `Applying ${ids.length} improvement${ids.length !== 1 ? 's' : ''}...`;

      const applyRes = await fetch(`${baseUrl}/api/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ improvementIds: ids }),
      });

      if (!applyRes.ok) {
        const err = await applyRes.json() as any;
        spinner.fail(`Apply failed: ${err.error}`);
        process.exit(1);
      }

      const result = await applyRes.json() as any;
      spinner.succeed(chalk.green(`Applied ${result.applied} improvement${result.applied !== 1 ? 's' : ''} to CLAUDE.md`));
    } catch (err) {
      spinner.fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// rules command
const rulesCmd = program
  .command('rules')
  .description('Manage CLAUDE.md learning rules');

rulesCmd
  .command('list')
  .description('List active rules')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const port = 3939;
    const res = await fetch(`http://localhost:${port}/api/rules`);
    const data = await res.json() as any;
    const items = data.items ?? [];

    if (items.length === 0) {
      console.log('No active rules. Run a scan to generate improvement suggestions.');
      return;
    }

    console.log(chalk.bold(`\nActive Rules (${items.length})\n`));
    items.forEach((rule: any, i: number) => {
      const score = rule.effectivenessScore !== undefined
        ? chalk.green(` [${(rule.effectivenessScore * 100).toFixed(0)}%]`)
        : chalk.dim(' [no data]');
      console.log(`${i + 1}. ${rule.content}${score}`);
      if (rule.category) console.log(chalk.dim(`   ${rule.category}`));
    });
    console.log('');
  });

rulesCmd
  .command('add <rule>')
  .description('Add a rule manually')
  .option('--category <cat>', 'Rule category')
  .action(async (rule: string, options) => {
    const chalk = (await import('chalk')).default;
    const port = 3939;
    const res = await fetch(`http://localhost:${port}/api/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: rule, category: options.category }),
    });
    if (res.ok) {
      console.log(chalk.green('✓ Rule added'));
    } else {
      console.error(chalk.red('Failed to add rule'));
      process.exit(1);
    }
  });

rulesCmd
  .command('retire <id>')
  .description('Retire a rule by ID')
  .action(async (id: string) => {
    const chalk = (await import('chalk')).default;
    const port = 3939;
    const res = await fetch(`http://localhost:${port}/api/rules/${id}`, { method: 'DELETE' });
    if (res.ok) {
      console.log(chalk.green('✓ Rule retired'));
    } else {
      console.error(chalk.red('Failed to retire rule'));
    }
  });

program.parse();
