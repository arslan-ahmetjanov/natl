import { dirname, resolve, isAbsolute, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ArtifactMode, EngineAdapter, AdapterFactory, LocatorRef } from './adapter.js';
import { httpRequest } from './api.js';
import {
  loadMergedProjectConfig,
  resolveRunSettings,
  type NatlProjectConfig,
} from './config.js';
import { ExpressionEngine, type VarScope } from './expr.js';
import {
  formatLocatorRef,
  normalizeElementsMap,
  resolveLocator,
} from './locator.js';
import { parseNatlFile, resolveImportPath } from './parser.js';
import { loadSecretsForFile, type SecretsStore } from './secrets.js';
import { formatStepFail } from './step-format.js';
import type { NatFileMeta, Step } from './types.js';

function fileLocatorStrategy(doc: NatFileMeta, fallback: string): string {
  const s = doc.locator_strategy?.trim();
  return s || fallback;
}
export class AssertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertError';
  }
}

export class SoftAssertError extends Error {
  constructor(
    message: string,
    readonly failures: SoftAssertFailure[],
  ) {
    super(message);
    this.name = 'SoftAssertError';
  }
}

export interface SoftAssertFailure {
  message: string;
  screenshotPath?: string;
}

/** Resolve `do: page.action` or unambiguous `do: action` against the actions registry. */
export function resolveDoTarget(
  target: string,
  actionsRegistry: Map<string, unknown>,
): { file?: string; action: string } {
  const t = target.trim();
  if (!t) {
    throw new Error('do: target is empty (expected page.action or action)');
  }
  if (t.includes('.')) {
    const i = t.indexOf('.');
    const page = t.slice(0, i).trim();
    const action = t.slice(i + 1).trim();
    if (!page || !action) {
      throw new Error(`do: invalid target "${t}" (expected page.action)`);
    }
    return { file: page, action };
  }
  const qualified = [...actionsRegistry.keys()].filter(
    (k) => k.includes('/') && k.slice(k.lastIndexOf('/') + 1) === t,
  );
  const uniquePages = [...new Set(qualified)];
  if (uniquePages.length > 1) {
    throw new Error(
      `do: "${t}" is ambiguous (${uniquePages.join(', ')}); use page.action`,
    );
  }
  if (uniquePages.length === 1) {
    const key = uniquePages[0];
    const slash = key.lastIndexOf('/');
    return { file: key.slice(0, slash), action: key.slice(slash + 1) };
  }
  if (actionsRegistry.has(t)) {
    return { action: t };
  }
  throw new Error(`do: action not found: ${t}`);
}

export interface RunOptions {
  file: string;
  /** Explicit engine (e.g. CLI `--engine`); wins over test YAML and project config */
  engine?: string;
  /** Explicit headless (e.g. CLI `--headed` → false); wins over project config */
  headless?: boolean;
  /** Explicit retries (e.g. CLI `--retries`); wins over test YAML and project config */
  retries?: number;
  /** Explicit trace mode (e.g. CLI `--trace`); wins over project config */
  trace?: ArtifactMode;
  /** Explicit video mode (e.g. CLI `--video`); wins over project config */
  video?: ArtifactMode;
  adapters?: Record<string, AdapterFactory>;
  vars?: Record<string, unknown>;
  logger?: (level: string, message: string) => void;
  /** Take a screenshot on failure (default true) */
  screenshot?: boolean;
  /** Take a screenshot on each soft assert failure (default false; also from project config) */
  softAssertScreenshot?: boolean;
  /** Directory for failure screenshots relative to the scenario file (default `artifacts`) */
  artifactsDir?: string;
  /**
   * Project config. `undefined` = auto-load walking up from the test file / cwd.
   * `null` = do not load project config.
   */
  projectConfig?: NatlProjectConfig | null;
  /** Load `config/<env>.yaml` over base config (ignored when `projectConfig` is set) */
  env?: string;
  /** Explicit env-profile file (ignored when `projectConfig` is set); mutually exclusive with `env` */
  configPath?: string;
  /** Default timeout when the test YAML omits `timeout` (also filled from project config) */
  timeout?: number;
  /** Injected as `vars.base_url` when the test does not define its own */
  baseUrl?: string;
}

export interface RunResult {
  ok: boolean;
  name?: string;
  error?: string;
  durationMs: number;
  /** Absolute path to failure screenshot, if taken (last failed attempt) */
  screenshotPath?: string;
  /** Absolute path to Playwright trace zip, if saved */
  tracePath?: string;
  /** Absolute path to Playwright video, if saved */
  videoPath?: string;
  /** 1-based index of the attempt that produced this result */
  attempt?: number;
  /** How many attempts were actually run */
  attempts?: number;
  /** True when an earlier attempt failed and a later one passed */
  flaky?: boolean;
  /** When the scenario defines `cases:` — one result per row */
  caseResults?: RunResult[];
}

const CASE_META_KEYS = new Set(['name', 'label']);

function caseRowVars(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!CASE_META_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export function caseDisplayName(
  base: string | undefined,
  index: number,
  row: Record<string, unknown>,
): string {
  const baseName = base?.trim() || 'test';
  const label = row.name ?? row.label;
  if (typeof label === 'string' && label.trim()) {
    return `${baseName} [${label.trim()}]`;
  }
  return `${baseName} [case ${index + 1}]`;
}

function safeArtifactName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/^_|_$/g, '') || 'test';
}

function makeArtifactBaseName(
  testName: string | undefined,
  sourcePath: string | undefined,
  attempt?: number,
): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const label = safeArtifactName(testName ?? (sourcePath ? basename(sourcePath, '.yaml') : 'test'));
  const attemptSuffix = attempt !== undefined ? `-attempt-${attempt}` : '';
  return `${stamp}-${label}${attemptSuffix}`;
}

function createHttpStubAdapter(): EngineAdapter {
  const fail = (method: string): never => {
    throw new Error(
      `UI method "${method}" is not available under engine "http". ` +
        `Use a UI engine (e.g. playwright) or keep UI steps outside \`with: http\`.`,
    );
  };
  return {
    goto: async () => fail('goto'),
    click: async () => fail('click'),
    fill: async () => fail('fill'),
    select: async () => fail('select'),
    check: async () => fail('check'),
    uncheck: async () => fail('uncheck'),
    wait: async () => fail('wait'),
    waitMs: async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
    },
    screenshot: async () => fail('screenshot'),
    getText: async () => fail('getText'),
    getAttr: async () => fail('getAttr'),
    isVisible: async () => fail('isVisible'),
    getCurrentUrl: async () => 'about:blank',
    scroll: async () => fail('scroll'),
    swipe: async () => fail('swipe'),
    longPress: async () => fail('longPress'),
    dispose: async () => undefined,
  };
}

async function captureFailureScreenshot(
  adapter: EngineAdapter,
  baseDir: string,
  artifactsDir: string,
  baseName: string,
): Promise<string> {
  const file = join(baseDir, artifactsDir, `${baseName}.png`);
  await adapter.screenshot(file, { fullPage: true });
  return file;
}

async function captureEngineArtifacts(
  adapter: EngineAdapter,
  ok: boolean,
  baseDir: string,
  artifactsDir: string,
  baseName: string,
  log: (level: string, message: string) => void,
): Promise<{ tracePath?: string; videoPath?: string }> {
  if (!adapter.finalizeArtifacts) return {};
  try {
    return await adapter.finalizeArtifacts({
      ok,
      artifactsDir: join(baseDir, artifactsDir),
      baseName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `Trace/video failed: ${msg}`);
    return {};
  }
}

function resolveProjectConfig(options: RunOptions, doc: NatFileMeta): NatlProjectConfig | undefined {
  if (options.projectConfig === null) return undefined;
  if (options.projectConfig) return options.projectConfig;
  const startDir = doc.sourcePath ? dirname(doc.sourcePath) : process.cwd();
  return loadMergedProjectConfig({
    startDir,
    fallbackDir: process.cwd(),
    env: options.env,
    configPath: options.configPath,
  });
}

export async function runNatlFile(options: RunOptions): Promise<RunResult> {
  const start = Date.now();
  const doc = parseNatlFile(options.file);
  const projectConfig = resolveProjectConfig(options, doc);
  const settings = resolveRunSettings({
    config: projectConfig,
    test: { engine: doc.engine, timeout: doc.timeout, retries: doc.retries },
    cli: {
      engine: options.engine,
      headless: options.headless,
      retries: options.retries,
      trace: options.trace,
      video: options.video,
    },
  });
  const engineName = settings.engine;
  const takeScreenshot = options.screenshot !== false;
  const artifactsDir = options.artifactsDir ?? settings.artifactsDir;
  const softAssertScreenshot =
    options.softAssertScreenshot ?? projectConfig?.soft_assert_screenshot ?? false;
  const traceMode = settings.trace;
  const videoMode = settings.video;
  const needEngineArtifacts = traceMode !== 'off' || videoMode !== 'off';
  const defaultTimeout = settings.timeout ?? options.timeout;
  const baseUrl = options.baseUrl ?? settings.baseUrl;
  const maxAttempts = 1 + Math.max(0, settings.retries);

  const secrets = loadSecretsForFile(doc.secrets, doc.sourcePath);
  const resolvedVars = (secrets.resolveDeep(doc.vars ?? {}) as VarScope) ?? {};
  const defaultLocatorStrategy = settings.locatorStrategy;
  const rootElementStrategy = fileLocatorStrategy(doc, defaultLocatorStrategy);

  // Merge elements into vars for POM (normalized LocatorRef)
  Object.assign(resolvedVars, normalizeElementsMap(doc.elements, rootElementStrategy));

  if (baseUrl !== undefined && resolvedVars.base_url === undefined) {
    resolvedVars.base_url = baseUrl;
  }

  if (options.vars) {
    Object.assign(resolvedVars, secrets.resolveDeep(options.vars) as VarScope);
  }

  if (doc.data) {
    resolvedVars.data = secrets.resolveDeep(doc.data);
  }

  // Load imports (merge actions/elements/vars)
  const importedDocs: NatFileMeta[] = [];
  if (doc.imports && doc.sourcePath) {
    for (const imp of doc.imports) {
      const path = resolveImportPath(doc.sourcePath, imp);
      const imported = parseNatlFile(path);
      importedDocs.push(imported);
      Object.assign(
        resolvedVars,
        normalizeElementsMap(
          imported.elements,
          fileLocatorStrategy(imported, defaultLocatorStrategy),
        ),
      );
      if (imported.vars) {
        Object.assign(resolvedVars, secrets.resolveDeep(imported.vars) as VarScope);
      }
    }
  }

  const actionsRegistry = new Map<string, { doc: NatFileMeta; steps: Step[] }>();
  for (const imported of importedDocs) {
    if (imported.actions) {
      const pageName =
        imported.name?.replace(/Page$/i, '').toLowerCase() ??
        (imported.sourcePath
          ? imported.sourcePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.ya?ml$/, '')
          : 'page');
      for (const [actionName, steps] of Object.entries(imported.actions)) {
        actionsRegistry.set(`${pageName}/${actionName}`, { doc: imported, steps });
        actionsRegistry.set(actionName, { doc: imported, steps });
      }
    }
  }
  if (doc.actions) {
    for (const [actionName, steps] of Object.entries(doc.actions)) {
      actionsRegistry.set(actionName, { doc, steps });
    }
  }

  const factory = options.adapters?.[engineName];
  const httpRoot = engineName === 'http';
  if (!factory && !httpRoot) {
    return {
      ok: false,
      name: doc.name,
      error: `No adapter registered for engine: ${engineName}`,
      durationMs: Date.now() - start,
      attempt: 1,
      attempts: 1,
    };
  }

  const log =
    options.logger ??
    ((level, msg) => {
      const masked = secrets.mask(msg);
      const prefix = `[${level}]`;
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${masked}`);
    });

  const baseDir = doc.sourcePath ? dirname(doc.sourcePath) : process.cwd();

  const runCtx = {
    doc,
    options,
    factory,
    httpRoot,
    secrets,
    log,
    baseDir,
    resolvedVars,
    actionsRegistry,
    engineName,
    defaultTimeout,
    settings,
    takeScreenshot,
    artifactsDir,
    softAssertScreenshot,
    traceMode,
    videoMode,
    needEngineArtifacts,
    maxAttempts,
  };

  if (doc.cases && doc.cases.length > 0) {
    const caseResults: RunResult[] = [];
    for (let i = 0; i < doc.cases.length; i++) {
      const row = doc.cases[i]!;
      const caseName = caseDisplayName(doc.name, i, row);
      log('info', `Case ${i + 1}/${doc.cases.length}: ${caseName}`);
      const caseStart = Date.now();
      const result = await runScenarioAttempts(runCtx, {
        displayName: caseName,
        extraVars: secrets.resolveDeep(caseRowVars(row)) as VarScope,
        wallStart: caseStart,
      });
      caseResults.push(result);
    }
    const failed = caseResults.filter((c) => !c.ok);
    const firstFail = failed[0];
    return {
      ok: failed.length === 0,
      name: doc.name,
      error:
        failed.length === 0
          ? undefined
          : failed.map((c) => `${c.name}: ${c.error ?? 'failed'}`).join('\n'),
      durationMs: Date.now() - start,
      screenshotPath: firstFail?.screenshotPath,
      tracePath: firstFail?.tracePath,
      videoPath: firstFail?.videoPath,
      caseResults,
    };
  }

  return runScenarioAttempts(runCtx, {
    displayName: doc.name,
    extraVars: {},
    wallStart: start,
  });
}

interface ScenarioRunContext {
  doc: NatFileMeta;
  options: RunOptions;
  factory?: AdapterFactory;
  httpRoot: boolean;
  secrets: SecretsStore;
  log: (level: string, message: string) => void;
  baseDir: string;
  resolvedVars: VarScope;
  actionsRegistry: Map<string, { doc: NatFileMeta; steps: Step[] }>;
  engineName: string;
  defaultTimeout?: number;
  settings: ReturnType<typeof resolveRunSettings>;
  takeScreenshot: boolean;
  artifactsDir: string;
  softAssertScreenshot: boolean;
  traceMode: ArtifactMode;
  videoMode: ArtifactMode;
  needEngineArtifacts: boolean;
  maxAttempts: number;
}

async function runScenarioAttempts(
  ctx: ScenarioRunContext,
  opts: {
    displayName?: string;
    extraVars: VarScope;
    wallStart: number;
  },
): Promise<RunResult> {
  const {
    doc,
    options,
    factory,
    httpRoot,
    secrets,
    log,
    baseDir,
    resolvedVars,
    actionsRegistry,
    engineName,
    defaultTimeout,
    settings,
    takeScreenshot,
    artifactsDir,
    softAssertScreenshot,
    needEngineArtifacts,
    maxAttempts,
    traceMode,
    videoMode,
  } = ctx;

  let lastError: string | undefined;
  let lastScreenshotPath: string | undefined;
  let lastTracePath: string | undefined;
  let lastVideoPath: string | undefined;
  let hadFailure = false;
  let attemptsRun = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptsRun = attempt;
    let adapter: EngineAdapter | undefined;

    if (attempt > 1) {
      log('info', `Retry ${attempt}/${maxAttempts}: ${opts.displayName ?? options.file}`);
    }

    try {
      // Fresh vars/expr per attempt so retries start from a clean scenario state
      const attemptVars: VarScope = { ...resolvedVars, ...opts.extraVars };
      adapter = httpRoot
        ? createHttpStubAdapter()
        : await factory!({
            timeout: defaultTimeout,
            headless: settings.headless,
            browser: settings.browser,
            viewport: settings.viewport,
            trace: traceMode,
            video: videoMode,
          });

      const expr = new ExpressionEngine(attemptVars, secrets);
      const interp = new InterpreterContext({
        adapter,
        expr,
        secrets,
        log,
        baseDir,
        sourcePath: doc.sourcePath,
        actionsRegistry,
        defaultTimeout,
        defaultLocatorStrategy: settings.locatorStrategy,
        adapters: options.adapters ?? {},
        engineName,
        artifactsDir,
        softAssertScreenshot,
        testName: opts.displayName ?? doc.name,
      });

      if (doc.before_each) {
        await interp.runSteps(doc.before_each);
      }

      await interp.runSteps(doc.steps);

      if (doc.after_each) {
        await interp.runSteps(doc.after_each);
      }

      interp.throwIfSoftFailures();

      if (adapter && needEngineArtifacts) {
        const baseName = makeArtifactBaseName(
          opts.displayName ?? doc.name,
          doc.sourcePath,
          maxAttempts > 1 ? attempt : undefined,
        );
        await captureEngineArtifacts(adapter, true, baseDir, artifactsDir, baseName, log);
      }

      return {
        ok: true,
        name: opts.displayName ?? doc.name,
        durationMs: Date.now() - opts.wallStart,
        attempt,
        attempts: attemptsRun,
        flaky: hadFailure || undefined,
      };
    } catch (err) {
      hadFailure = true;
      const message = err instanceof Error ? err.message : String(err);
      lastError = secrets.mask(message);

      const baseName = makeArtifactBaseName(
        opts.displayName ?? doc.name,
        doc.sourcePath,
        maxAttempts > 1 ? attempt : undefined,
      );

      if (adapter && takeScreenshot) {
        try {
          lastScreenshotPath = await captureFailureScreenshot(
            adapter,
            baseDir,
            artifactsDir,
            baseName,
          );
        } catch (shotErr) {
          const shotMsg = shotErr instanceof Error ? shotErr.message : String(shotErr);
          log('warn', `Screenshot failed: ${shotMsg}`);
        }
      }

      if (adapter && needEngineArtifacts) {
        const arts = await captureEngineArtifacts(
          adapter,
          false,
          baseDir,
          artifactsDir,
          baseName,
          log,
        );
        lastTracePath = arts.tracePath;
        lastVideoPath = arts.videoPath;
      }

      log('error', lastError);
      if (attempt < maxAttempts) {
        continue;
      }
    } finally {
      if (adapter) {
        await adapter.dispose().catch(() => undefined);
      }
    }
  }

  return {
    ok: false,
    name: opts.displayName ?? doc.name,
    error: lastError,
    durationMs: Date.now() - opts.wallStart,
    screenshotPath: lastScreenshotPath,
    tracePath: lastTracePath,
    videoPath: lastVideoPath,
    attempt: attemptsRun,
    attempts: attemptsRun,
  };
}

interface InterpreterContextOptions {
  adapter: EngineAdapter;
  expr: ExpressionEngine;
  secrets: SecretsStore;
  log: (level: string, message: string) => void;
  baseDir: string;
  sourcePath?: string;
  actionsRegistry: Map<string, { doc: NatFileMeta; steps: Step[] }>;
  defaultTimeout?: number;
  defaultLocatorStrategy: string;
  adapters: Record<string, AdapterFactory>;
  engineName: string;
  artifactsDir: string;
  softAssertScreenshot: boolean;
  testName?: string;
}

class InterpreterContext {
  private debug = false;
  private softFailures: SoftAssertFailure[] = [];
  private softShotIndex = 0;
  private readonly engineStack: string[] = [];

  constructor(private readonly opts: InterpreterContextOptions) {
    this.engineStack.push(opts.engineName);
  }

  private currentEngine(): string {
    return this.engineStack[this.engineStack.length - 1] ?? this.opts.engineName;
  }

  private loc(raw: string): LocatorRef {
    return resolveLocator(raw, {
      get: (path) => this.opts.expr.get(path),
      interpolate: (s) => this.opts.expr.interpolate(s),
      defaultStrategy: this.opts.defaultLocatorStrategy,
    });
  }

  private mergeElements(doc: NatFileMeta): void {
    const normalized = normalizeElementsMap(
      doc.elements,
      fileLocatorStrategy(doc, this.opts.defaultLocatorStrategy),
    );
    for (const [k, v] of Object.entries(normalized)) {
      this.opts.expr.set(k, v);
    }
  }

  throwIfSoftFailures(): void {
    if (this.softFailures.length === 0) return;
    const lines = this.softFailures.map((f) => `  ${f.message}`);
    throw new SoftAssertError(
      `Soft assert failures (${this.softFailures.length}):\n${lines.join('\n')}`,
      this.softFailures,
    );
  }

  async runSteps(steps: Step[]): Promise<void> {
    for (const step of steps) {
      await this.runStep(step);
    }
  }

  private async runStep(step: Step): Promise<void> {
    if (this.debug || step.debug) {
      this.opts.log('debug', `Step: ${JSON.stringify(step)}`);
    }

    try {
      await this.executeStep(step);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (reason.startsWith('FAIL ') || err instanceof SoftAssertError) {
        throw err instanceof Error ? err : new Error(reason);
      }
      const interpolate = (s: string) => this.opts.expr.interpolate(s);
      throw new Error(
        formatStepFail(this.opts.sourcePath, step, reason, interpolate, {
          engine: this.currentEngine(),
        }),
      );
    }
  }

  private async recordSoftFailure(
    step: Extract<Step, { type: 'assert' }>,
    err: unknown,
  ): Promise<void> {
    const reason = err instanceof Error ? err.message : String(err);
    const interpolate = (s: string) => this.opts.expr.interpolate(s);
    const message = formatStepFail(this.opts.sourcePath, step, reason, interpolate, {
      engine: this.currentEngine(),
    });
    this.opts.log('error', message);

    let screenshotPath: string | undefined;
    if (this.opts.softAssertScreenshot) {
      try {
        this.softShotIndex += 1;
        const baseName = `${makeArtifactBaseName(this.opts.testName, this.opts.sourcePath)}-soft-${this.softShotIndex}`;
        screenshotPath = await captureFailureScreenshot(
          this.opts.adapter,
          this.opts.baseDir,
          this.opts.artifactsDir,
          baseName,
        );
        this.opts.log('info', `Soft assert screenshot: ${screenshotPath}`);
      } catch (shotErr) {
        const shotMsg = shotErr instanceof Error ? shotErr.message : String(shotErr);
        this.opts.log('warn', `Soft assert screenshot failed: ${shotMsg}`);
      }
    }

    this.softFailures.push({ message, screenshotPath });
  }

  private async executeStep(step: Step): Promise<void> {
    switch (step.type) {
      case 'goto': {
        const url = this.resolveUrl(this.opts.expr.interpolate(step.url));
        await this.opts.adapter.goto(url, { timeout: step.timeout ?? this.opts.defaultTimeout });
        break;
      }
      case 'click': {
        const locator = this.loc(step.locator);
        await this.opts.adapter.click(locator, { timeout: step.timeout ?? this.opts.defaultTimeout });
        break;
      }
      case 'fill': {
        const locator = this.loc(step.locator);
        const value = this.opts.expr.interpolate(step.with);
        await this.opts.adapter.fill(locator, value, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
        });
        break;
      }
      case 'select': {
        const locator = this.loc(step.locator);
        const value = this.opts.expr.interpolate(step.with);
        await this.opts.adapter.select(locator, value, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
        });
        break;
      }
      case 'check': {
        const locator = this.loc(step.locator);
        await this.opts.adapter.check(locator, { timeout: step.timeout ?? this.opts.defaultTimeout });
        break;
      }
      case 'uncheck': {
        const locator = this.loc(step.locator);
        await this.opts.adapter.uncheck(locator, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
        });
        break;
      }
      case 'scroll': {
        const locator = this.loc(step.locator);
        await this.opts.adapter.scroll(locator, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
          intoView: step.intoView,
          deltaX: step.deltaX,
          deltaY: step.deltaY,
        });
        break;
      }
      case 'swipe': {
        const locator = this.loc(step.locator);
        await this.opts.adapter.swipe(locator, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
          direction: step.direction,
          distance: step.distance,
        });
        break;
      }
      case 'long_press': {
        const locator = this.loc(step.locator);
        await this.opts.adapter.longPress(locator, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
          durationMs: step.durationMs,
        });
        break;
      }
      case 'wait': {
        if (step.ms !== undefined) {
          await this.opts.adapter.waitMs(step.ms);
        } else if (step.selector) {
          const locator = this.loc(step.selector);
          await this.opts.adapter.wait(locator, {
            state: step.state,
            timeout: step.timeout ?? this.opts.defaultTimeout,
          });
        }
        break;
      }
      case 'screenshot': {
        const file = this.opts.expr.interpolate(step.file);
        const abs = resolve(this.opts.baseDir, file);
        await this.opts.adapter.screenshot(abs, { fullPage: step.fullPage });
        break;
      }
      case 'assert': {
        if (step.soft) {
          try {
            await this.runAssert(step);
          } catch (err) {
            await this.recordSoftFailure(step, err);
          }
        } else {
          await this.runAssert(step);
        }
        break;
      }
      case 'with': {
        this.engineStack.push(step.engine);
        try {
          await this.runSteps(step.steps);
        } finally {
          this.engineStack.pop();
        }
        break;
      }
      case 'api': {
        const url = this.resolveHttpUrl(this.opts.expr.interpolate(step.url));
        const headers = this.opts.expr.interpolateDeep(step.headers ?? {}) as Record<
          string,
          string
        >;
        const body = this.opts.expr.interpolateDeep(step.body);
        const res = await httpRequest({
          method: step.method,
          url,
          headers,
          body,
          timeout: step.timeout ?? this.opts.defaultTimeout,
        });
        if (step.save) {
          this.opts.expr.set(step.save, res);
        }
        break;
      }
      case 'set': {
        this.opts.expr.executeSet(step.expression);
        break;
      }
      case 'get_text': {
        const locator = this.loc(step.locator);
        const text = await this.opts.adapter.getText(locator, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
        });
        if (step.save) this.opts.expr.set(step.save, text);
        break;
      }
      case 'get_attr': {
        const locator = this.loc(step.locator);
        const attr = this.opts.expr.interpolate(step.attr);
        const value = await this.opts.adapter.getAttr(locator, attr, {
          timeout: step.timeout ?? this.opts.defaultTimeout,
        });
        if (step.save) this.opts.expr.set(step.save, value);
        break;
      }
      case 'log': {
        const message = this.opts.expr.interpolate(step.message);
        this.opts.log(step.level, message);
        break;
      }
      case 'debug': {
        this.debug = step.enabled;
        break;
      }
      case 'if': {
        const ok = this.opts.expr.evaluateCondition(step.condition);
        if (ok) {
          await this.runSteps(step.then);
        } else if (step.else) {
          await this.runSteps(step.else);
        }
        break;
      }
      case 'for': {
        const iterable = this.resolveIterable(step.iterable);
        for (const item of iterable) {
          this.opts.expr.set(step.variable, item);
          await this.runSteps(step.steps);
        }
        break;
      }
      case 'repeat': {
        if (step.times !== undefined) {
          for (let i = 0; i < step.times; i++) {
            this.opts.expr.set('i', i);
            await this.runSteps(step.steps);
          }
        } else if (step.until) {
          let guard = 0;
          while (!this.opts.expr.evaluateCondition(step.until)) {
            await this.runSteps(step.steps);
            guard++;
            if (guard > 1000) {
              throw new Error(`repeat until exceeded 1000 iterations: ${step.until}`);
            }
          }
        }
        break;
      }
      case 'parallel': {
        const tasks = step.steps.map((s) => this.runStep(s));
        if (step.wait === 'any') {
          await Promise.race(tasks);
        } else {
          await Promise.all(tasks);
        }
        break;
      }
      case 'include': {
        await this.runInclude(step);
        break;
      }
      case 'do': {
        await this.runDo(step);
        break;
      }
      default: {
        const _exhaustive: never = step;
        throw new Error(`Unhandled step: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  private resolveUrl(url: string): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      // file://PLACEHOLDER or file://./relative — rewrite relative file URLs
      if (url.startsWith('file://') && !url.startsWith('file:///') && !/^file:\/\/[A-Za-z]:/.test(url)) {
        const rest = url.slice('file://'.length);
        const abs = resolve(this.opts.baseDir, rest);
        return pathToFileURL(abs).href;
      }
      return url;
    }
    // Relative path → file URL based on test file directory
    const abs = isAbsolute(url) ? url : resolve(this.opts.baseDir, url);
    return pathToFileURL(abs).href;
  }

  /** Resolve HTTP URL; relative paths use vars.base_url when set. */
  private resolveHttpUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    const base = this.opts.expr.get('base_url');
    if (typeof base === 'string' && /^https?:\/\//i.test(base)) {
      try {
        return new URL(url, base.endsWith('/') ? base : `${base}/`).href;
      } catch {
        return url;
      }
    }
    return url;
  }

  private resolveIterable(iterableExpr: string): unknown[] {
    const trimmed = iterableExpr.trim();
    // range(1, 5)
    if (/^range\s*\(/.test(trimmed)) {
      const val = this.opts.expr.evaluate(trimmed);
      if (!Array.isArray(val)) throw new Error(`range did not return array: ${trimmed}`);
      return val;
    }
    // JSON-like array or variable
    const val = this.opts.expr.evaluate(trimmed);
    if (!Array.isArray(val)) {
      throw new Error(`for iterable is not an array: ${trimmed}`);
    }
    return val;
  }

  private async runAssert(step: Extract<Step, { type: 'assert' }>): Promise<void> {
    const timeout = step.timeout ?? this.opts.defaultTimeout;

    switch (step.kind) {
      case 'text': {
        const locator = this.loc(step.locator ?? '');
        const expected = this.opts.expr.interpolate(step.expected ?? '');
        const actual = (await this.opts.adapter.getText(locator, { timeout })).trim();
        if (actual !== expected) {
          throw new AssertError(`assert text failed: expected "${expected}", got "${actual}"`);
        }
        break;
      }
      case 'contains': {
        const locator = this.loc(step.locator ?? '');
        const expected = this.opts.expr.interpolate(step.expected ?? '');
        const actual = (await this.opts.adapter.getText(locator, { timeout })).trim();
        if (!actual.includes(expected)) {
          throw new AssertError(
            `assert contains failed: expected to contain "${expected}", got "${actual}"`,
          );
        }
        break;
      }
      case 'visible': {
        const locator = this.loc(step.locator ?? '');
        const visible = await this.opts.adapter.isVisible(locator, { timeout });
        if (!visible) {
          throw new AssertError(`assert visible failed: ${formatLocatorRef(locator)}`);
        }
        break;
      }
      case 'hidden': {
        const locator = this.loc(step.locator ?? '');
        const visible = await this.opts.adapter.isVisible(locator, { timeout });
        if (visible) {
          throw new AssertError(`assert hidden failed: ${formatLocatorRef(locator)} is visible`);
        }
        break;
      }
      case 'attr': {
        const locator = this.loc(step.locator ?? '');
        const attr = this.opts.expr.interpolate(step.attr ?? '');
        const expected = this.opts.expr.interpolate(step.expected ?? '');
        const actual = (await this.opts.adapter.getAttr(locator, attr, { timeout })) ?? '';
        const op = step.operator ?? '==';
        const ok = this.compareValues(actual, expected, op);
        if (!ok) {
          throw new AssertError(
            `assert attr failed: ${attr} ${op} "${expected}", got "${actual}"`,
          );
        }
        break;
      }
      case 'url': {
        const url = await this.opts.adapter.getCurrentUrl();
        const expected = this.opts.expr.interpolate(step.expected ?? '');
        const op = step.operator ?? '==';
        let ok = false;
        if (op === 'contains') {
          ok = url.includes(expected);
        } else {
          ok = url === expected || url.endsWith(expected);
        }
        if (!ok) {
          throw new AssertError(`assert current_url ${op} "${expected}", got "${url}"`);
        }
        break;
      }
      case 'expr': {
        // Inject current_url into scope for expressions like current_url == "..."
        const url = await this.opts.adapter.getCurrentUrl();
        this.opts.expr.set('current_url', url);
        const expression = step.expression ?? '';
        // Handle "current_url == ..." and "current_url contains ..." specially if not already
        const urlMatch = expression.match(/^current_url\s+(==|contains)\s+(.+)$/i);
        if (urlMatch) {
          const expected = this.opts.expr.interpolate(
            urlMatch[2].trim().replace(/^["']|["']$/g, ''),
          );
          const ok =
            urlMatch[1] === 'contains' ? url.includes(expected) : url === expected || url.endsWith(expected);
          if (!ok) {
            throw new AssertError(`assert current_url ${urlMatch[1]} "${expected}", got "${url}"`);
          }
          break;
        }
        const result = this.opts.expr.evaluateCondition(expression);
        if (!result) {
          throw new AssertError(`assert failed: ${expression}`);
        }
        break;
      }
    }
  }

  private compareValues(actual: string, expected: string, op: string): boolean {
    switch (op) {
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      case 'contains':
        return actual.includes(expected);
      case 'matches':
        return new RegExp(expected).test(actual);
      default:
        return actual === expected;
    }
  }

  private async runDo(step: Extract<Step, { type: 'do' }>): Promise<void> {
    const resolved = resolveDoTarget(step.target, this.opts.actionsRegistry);
    await this.runInclude({
      type: 'include',
      file: resolved.file,
      action: resolved.action,
      vars: step.vars,
      timeout: step.timeout,
      engine: step.engine,
      save: step.save,
      debug: step.debug,
      line: step.line,
    });
  }

  private async runInclude(step: Extract<Step, { type: 'include' }>): Promise<void> {
    // Push vars
    const prev: VarScope = { ...this.opts.expr.getScope() };
    if (step.vars) {
      const resolved = this.opts.secrets.resolveDeep(
        this.opts.expr.interpolateDeep(step.vars),
      ) as VarScope;
      for (const [k, v] of Object.entries(resolved)) {
        this.opts.expr.set(k, v);
      }
    }

    try {
      if (step.action || (step.file && !step.file.endsWith('.yaml') && !step.file.endsWith('.yml'))) {
        const key = step.action
          ? step.file
            ? `${step.file}/${step.action}`
            : step.action
          : step.file!;
        const found =
          this.opts.actionsRegistry.get(key) ??
          this.opts.actionsRegistry.get(step.action ?? '') ??
          this.opts.actionsRegistry.get(step.file ?? '');
        if (found) {
          this.mergeElements(found.doc);
          await this.runSteps(found.steps);
          return;
        }
        // Try loading as file path for action style login/login
        if (step.file && this.opts.sourcePath) {
          const path = resolveImportPath(this.opts.sourcePath, step.file);
          const included = parseNatlFile(path);
          this.mergeElements(included);
          if (step.action && included.actions?.[step.action]) {
            await this.runSteps(included.actions[step.action]);
            return;
          }
          if (included.steps.length) {
            await this.runSteps(included.steps);
            return;
          }
        }
        throw new Error(`include action not found: ${key}`);
      }

      if (step.file && this.opts.sourcePath) {
        const path = resolveImportPath(this.opts.sourcePath, step.file);
        const included = parseNatlFile(path);
        this.mergeElements(included);
        await this.runSteps(included.steps);
        return;
      }

      throw new Error(`Invalid include: ${JSON.stringify(step)}`);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        this.opts.expr.set(k, v);
      }
    }
  }
}
