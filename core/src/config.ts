import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ArtifactMode } from './adapter.js';

const ARTIFACT_MODES = new Set<ArtifactMode>(['off', 'on', 'on-fail']);

/** Optional viewport hint passed through to the adapter factory. */
export interface ViewportHint {
  width: number;
  height: number;
}

/** Project-level defaults from `natl.config.yaml` / `natl.config.yml`. */
export interface NatlProjectConfig {
  engine?: string;
  timeout?: number;
  base_url?: string;
  headless?: boolean;
  /**
   * Adapter-specific browser id (opaque to core).
   * Example for Playwright: `chromium` | `firefox` | `webkit`.
   */
  browser?: string;
  /** Optional viewport hint for the UI session (adapter applies it). */
  viewport?: ViewportHint;
  /**
   * Default locator strategy for string elements / inline selectors
   * (web: `css` | `xpath`; default `css`).
   */
  locator_strategy?: string;
  artifacts_dir?: string;
  /** Extra full-scenario attempts after the first failure */
  retries?: number;
  /** Playwright trace policy (default `on-fail`) */
  trace?: ArtifactMode;
  /** Playwright video policy (default `off`) */
  video?: ArtifactMode;
  /** Screenshot on each soft assert failure (default false) */
  soft_assert_screenshot?: boolean;
  /** Absolute path of the base config file (`natl.config.*`) */
  path?: string;
  /** Absolute path of the env profile overlay (`config/<env>.yaml` or `--config`) */
  profilePath?: string;
}

export interface CliRunOverrides {
  /** Set only when `--engine` was passed */
  engine?: string;
  /** Set only when `--headed` (or a future `--headless`) was passed */
  headless?: boolean;
  /** Set only when `--retries` was passed */
  retries?: number;
  /** Set only when `--trace` was passed */
  trace?: ArtifactMode;
  /** Set only when `--video` was passed */
  video?: ArtifactMode;
}

export interface ResolvedRunSettings {
  engine: string;
  timeout?: number;
  headless: boolean;
  /** Opaque browser id for the adapter factory (from config). */
  browser?: string;
  viewport?: ViewportHint;
  /** Default locator strategy (config); page YAML may override per file. */
  locatorStrategy: string;
  artifactsDir: string;
  baseUrl?: string;
  /** Extra attempts after first failure; CLI > test > config > 0 */
  retries: number;
  /** CLI > config > `on-fail` */
  trace: ArtifactMode;
  /** CLI > config > `off` */
  video: ArtifactMode;
  configPath?: string;
  profilePath?: string;
}

function parseArtifactMode(
  raw: unknown,
  field: string,
  path?: string,
): ArtifactMode {
  if (typeof raw !== 'string' || !ARTIFACT_MODES.has(raw as ArtifactMode)) {
    throw new Error(
      `${path ?? 'natl.config'}: "${field}" must be one of: off, on, on-fail`,
    );
  }
  return raw as ArtifactMode;
}

export interface LoadMergedProjectConfigOptions {
  /** Walk-up start (usually the test file directory) */
  startDir: string;
  /** Second walk-up if `startDir` has no base config (usually cwd) */
  fallbackDir?: string;
  /** Load `config/<env>.yaml` relative to the project root */
  env?: string;
  /** Explicit overlay file path (mutually exclusive with `env`) */
  configPath?: string;
}

const CONFIG_NAMES = ['natl.config.yaml', 'natl.config.yml'] as const;
const PROFILE_EXTS = ['.yaml', '.yml'] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Walk parents from `startDir` looking for natl.config.yaml / .yml. */
export function findProjectConfigPath(startDir: string): string | undefined {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function parseProjectConfig(raw: unknown, path?: string): NatlProjectConfig {
  if (!isPlainObject(raw)) {
    throw new Error(
      path
        ? `Invalid project config ${path}: expected a YAML mapping`
        : 'Invalid project config: expected a YAML mapping',
    );
  }

  const out: NatlProjectConfig = { path };

  if (raw.engine !== undefined) {
    if (typeof raw.engine !== 'string' || !raw.engine.trim()) {
      throw new Error(`${path ?? 'natl.config'}: "engine" must be a non-empty string`);
    }
    out.engine = raw.engine.trim();
  }

  if (raw.timeout !== undefined) {
    if (typeof raw.timeout !== 'number' || !Number.isFinite(raw.timeout) || raw.timeout < 0) {
      throw new Error(`${path ?? 'natl.config'}: "timeout" must be a non-negative number`);
    }
    out.timeout = raw.timeout;
  }

  if (raw.base_url !== undefined) {
    if (typeof raw.base_url !== 'string') {
      throw new Error(`${path ?? 'natl.config'}: "base_url" must be a string`);
    }
    out.base_url = raw.base_url;
  }

  if (raw.headless !== undefined) {
    if (typeof raw.headless !== 'boolean') {
      throw new Error(`${path ?? 'natl.config'}: "headless" must be a boolean`);
    }
    out.headless = raw.headless;
  }

  if (raw.browser !== undefined) {
    if (typeof raw.browser !== 'string' || !raw.browser.trim()) {
      throw new Error(`${path ?? 'natl.config'}: "browser" must be a non-empty string`);
    }
    out.browser = raw.browser.trim();
  }

  if (raw.viewport !== undefined) {
    if (!isPlainObject(raw.viewport)) {
      throw new Error(`${path ?? 'natl.config'}: "viewport" must be a mapping with width/height`);
    }
    const { width, height } = raw.viewport;
    if (
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new Error(
        `${path ?? 'natl.config'}: "viewport" requires positive numeric width and height`,
      );
    }
    out.viewport = { width, height };
  }

  if (raw.locator_strategy !== undefined) {
    if (typeof raw.locator_strategy !== 'string' || !raw.locator_strategy.trim()) {
      throw new Error(
        `${path ?? 'natl.config'}: "locator_strategy" must be a non-empty string`,
      );
    }
    out.locator_strategy = raw.locator_strategy.trim();
  }

  if (raw.artifacts_dir !== undefined) {
    if (typeof raw.artifacts_dir !== 'string' || !raw.artifacts_dir.trim()) {
      throw new Error(`${path ?? 'natl.config'}: "artifacts_dir" must be a non-empty string`);
    }
    out.artifacts_dir = raw.artifacts_dir.trim();
  }

  if (raw.retries !== undefined) {
    if (typeof raw.retries !== 'number' || !Number.isInteger(raw.retries) || raw.retries < 0) {
      throw new Error(`${path ?? 'natl.config'}: "retries" must be a non-negative integer`);
    }
    out.retries = raw.retries;
  }

  if (raw.trace !== undefined) {
    out.trace = parseArtifactMode(raw.trace, 'trace', path);
  }

  if (raw.video !== undefined) {
    out.video = parseArtifactMode(raw.video, 'video', path);
  }

  if (raw.soft_assert_screenshot !== undefined) {
    if (typeof raw.soft_assert_screenshot !== 'boolean') {
      throw new Error(`${path ?? 'natl.config'}: "soft_assert_screenshot" must be a boolean`);
    }
    out.soft_assert_screenshot = raw.soft_assert_screenshot;
  }

  return out;
}

/** Load a config YAML from an absolute or relative path; throws if missing. */
export function loadProjectConfigFile(filePath: string): NatlProjectConfig {
  const path = resolve(filePath);
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const text = readFileSync(path, 'utf8');
  const raw = parseYaml(text);
  return parseProjectConfig(raw, path);
}

/** Load nearest project config walking up from `startDir`, or `undefined` if none. */
export function loadProjectConfig(startDir: string): NatlProjectConfig | undefined {
  const path = findProjectConfigPath(startDir);
  if (!path) return undefined;
  return loadProjectConfigFile(path);
}

/**
 * Resolve `config/<env>.yaml` or `.yml` under `projectRoot`.
 * Throws if neither exists.
 */
export function resolveEnvProfilePath(projectRoot: string, env: string): string {
  const name = env.trim();
  if (!name) {
    throw new Error('Env profile name must be a non-empty string');
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`Invalid env profile name "${env}": expected a simple name like "staging"`);
  }

  const dir = join(resolve(projectRoot), 'config');
  for (const ext of PROFILE_EXTS) {
    const candidate = join(dir, `${name}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Env profile not found: config/${name}.yaml (or .yml) under ${resolve(projectRoot)}`,
  );
}

/** Overlay wins on defined fields; preserves base `path` and sets `profilePath`. */
export function mergeProjectConfigs(
  base?: NatlProjectConfig | null,
  overlay?: NatlProjectConfig | null,
): NatlProjectConfig | undefined {
  if (!base && !overlay) return undefined;
  if (!overlay) {
    return base ? { ...base } : undefined;
  }
  if (!base) {
    return {
      ...overlay,
      profilePath: overlay.path ?? overlay.profilePath,
      path: undefined,
    };
  }
  return {
    engine: overlay.engine ?? base.engine,
    timeout: overlay.timeout ?? base.timeout,
    base_url: overlay.base_url ?? base.base_url,
    headless: overlay.headless ?? base.headless,
    browser: overlay.browser ?? base.browser,
    viewport: overlay.viewport ?? base.viewport,
    locator_strategy: overlay.locator_strategy ?? base.locator_strategy,
    artifacts_dir: overlay.artifacts_dir ?? base.artifacts_dir,
    retries: overlay.retries ?? base.retries,
    trace: overlay.trace ?? base.trace,
    video: overlay.video ?? base.video,
    soft_assert_screenshot: overlay.soft_assert_screenshot ?? base.soft_assert_screenshot,
    path: base.path,
    profilePath: overlay.path ?? overlay.profilePath,
  };
}

/**
 * Load base `natl.config.*` and optional env/`--config` overlay.
 * Priority inside the returned object: overlay fields over base.
 */
export function loadMergedProjectConfig(
  options: LoadMergedProjectConfigOptions,
): NatlProjectConfig | undefined {
  const env = options.env?.trim() || undefined;
  const configPath = options.configPath?.trim() || undefined;

  if (env && configPath) {
    throw new Error('Use either --env or --config, not both');
  }

  let base = loadProjectConfig(options.startDir);
  if (!base && options.fallbackDir) {
    base = loadProjectConfig(options.fallbackDir);
  }

  const projectRoot = base?.path
    ? dirname(base.path)
    : resolve(options.fallbackDir ?? options.startDir);

  let overlay: NatlProjectConfig | undefined;
  if (configPath) {
    overlay = loadProjectConfigFile(configPath);
  } else if (env) {
    const profilePath = resolveEnvProfilePath(projectRoot, env);
    overlay = loadProjectConfigFile(profilePath);
  }

  return mergeProjectConfigs(base, overlay);
}

/**
 * Merge run settings.
 * Priority: CLI (explicit) > test YAML fields > env profile > base config > defaults.
 * (Env profile must already be merged into `config` via `loadMergedProjectConfig`.)
 */
export function resolveRunSettings(input: {
  config?: NatlProjectConfig | null;
  test?: { engine?: string; timeout?: number; retries?: number };
  cli?: CliRunOverrides;
}): ResolvedRunSettings {
  const config = input.config ?? undefined;
  const test = input.test ?? {};
  const cli = input.cli ?? {};

  return {
    engine: cli.engine ?? test.engine ?? config?.engine ?? 'playwright',
    timeout: test.timeout ?? config?.timeout,
    headless: cli.headless ?? config?.headless ?? true,
    browser: config?.browser,
    viewport: config?.viewport,
    locatorStrategy: config?.locator_strategy ?? 'css',
    artifactsDir: config?.artifacts_dir ?? 'artifacts',
    baseUrl: config?.base_url,
    retries: cli.retries ?? test.retries ?? config?.retries ?? 0,
    trace: cli.trace ?? config?.trace ?? 'on-fail',
    video: cli.video ?? config?.video ?? 'off',
    configPath: config?.path,
    profilePath: config?.profilePath,
  };
}
