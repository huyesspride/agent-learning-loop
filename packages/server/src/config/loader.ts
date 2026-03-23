import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import yaml from 'yaml';
import { AppConfigSchema } from '@cll/shared';
import { DEFAULT_CONFIG } from './defaults.js';
import type { AppConfig } from '@cll/shared';

function expandHome(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideVal = override[key];
    const baseVal = base[key];
    if (
      overrideVal !== undefined &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null
    ) {
      result[key] = deepMerge(baseVal as object, overrideVal as object) as T[keyof T];
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as T[keyof T];
    }
  }
  return result;
}

function loadYamlFile(path: string): Partial<AppConfig> {
  try {
    const content = readFileSync(path, 'utf-8');
    return yaml.parse(content) ?? {};
  } catch {
    return {};
  }
}

function applyEnvOverrides(config: AppConfig): AppConfig {
  const result = { ...config, claude: { ...config.claude }, scan: { ...config.scan } };
  if (process.env.CLL_PORT) result.port = parseInt(process.env.CLL_PORT, 10);
  if (process.env.CLL_DB_PATH) result.dbPath = process.env.CLL_DB_PATH;
  // CLL dùng Claude Code CLI (child_process spawn), không gọi Anthropic API trực tiếp
  if (process.env.CLL_CLAUDE_MODEL) result.claude.model = process.env.CLL_CLAUDE_MODEL;
  return result;
}

let _config: AppConfig | null = null;

export function loadConfig(configPath?: string): AppConfig {
  if (_config) return _config;

  // 1. Start with defaults
  let config: AppConfig = { ...DEFAULT_CONFIG };

  // 2. Load project default.yaml (root of monorepo)
  const rootDefaultPath = join(process.cwd(), 'config', 'default.yaml');
  if (existsSync(rootDefaultPath)) {
    config = deepMerge(config, loadYamlFile(rootDefaultPath));
  }

  // 3. Load user config ~/.cll/config.yaml
  const userConfigPath = configPath ?? join(homedir(), '.cll', 'config.yaml');
  if (existsSync(userConfigPath)) {
    config = deepMerge(config, loadYamlFile(userConfigPath));
  }

  // 4. Apply env var overrides
  config = applyEnvOverrides(config);

  // 5. Expand ~ in paths
  config.dbPath = expandHome(config.dbPath);

  // 6. Validate with Zod
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }

  _config = result.data as AppConfig;
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}
