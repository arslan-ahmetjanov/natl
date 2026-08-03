import type {
  ActionOptions,
  AdapterFactory,
  AdapterFactoryOptions,
  EngineAdapter,
  LocatorRef,
  LongPressOptions,
  ScreenshotOptions,
  ScrollOptions,
  SwipeOptions,
  WaitOptions,
} from '@natl/core';
import { formatLocatorRef } from '@natl/core';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandBridge } from './bridge.js';
import { removeCypressProject, writeCypressProject } from './project.js';

/** Stable engine id used in YAML `engine:` and CLI `--engine`. */
export const engine = 'cypress' as const;

const SUPPORTED = ['electron', 'chrome', 'chromium', 'edge', 'firefox'] as const;

/** Resolve Cypress browser id; unknown throws. Default chrome (Electron often flaky in CI). */
export function resolveCypressBrowser(browser?: string): string {
  const key = (browser ?? 'chrome').trim().toLowerCase();
  if (key === 'chromium') return 'chrome';
  if ((SUPPORTED as readonly string[]).includes(key)) return key;
  throw new Error(
    `Cypress adapter does not support browser "${browser}". ` +
      `Supported: chrome (alias chromium), electron, edge, firefox. ` +
      `Install peer: npm install cypress && npx cypress install`,
  );
}

/** Validate locator strategy for the Cypress bridge. */
export function resolveCypressLocator(locator: LocatorRef): LocatorRef {
  const strategy = locator.strategy.trim().toLowerCase();
  if (strategy !== 'css' && strategy !== 'xpath') {
    throw new Error(
      `Cypress adapter does not support locator strategy "${locator.strategy}". ` +
        `Supported: css, xpath`,
    );
  }
  return { strategy, value: locator.value };
}

function loadCypress(): { run: (opts: Record<string, unknown>) => Promise<unknown> } {
  try {
    const require = createRequire(import.meta.url);
    return require('cypress') as { run: (opts: Record<string, unknown>) => Promise<unknown> };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot load Cypress. Install the peer dependency:\n` +
        `  npm install cypress\n` +
        `  npx cypress install\n` +
        `(${detail})`,
    );
  }
}

/** Map file:// pages into the Cypress project so `cy.visit` can serve them. */
function materializeFileUrl(projectRoot: string, url: string): string {
  const abs = fileURLToPath(url);
  const destDir = join(projectRoot, 'public');
  mkdirSync(destDir, { recursive: true });
  const name = basename(abs) || 'page.html';
  const dest = join(destDir, name);
  copyFileSync(abs, dest);
  return `/public/${name}`;
}

export class CypressAdapter implements EngineAdapter {
  private constructor(
    private readonly bridge: CommandBridge,
    private readonly projectRoot: string,
    private readonly runPromise: Promise<unknown>,
    private readonly defaultTimeout: number,
  ) {}

  static async create(options?: AdapterFactoryOptions): Promise<CypressAdapter> {
    const timeout = options?.timeout ?? 10000;
    const headless = options?.headless ?? true;
    const browser = resolveCypressBrowser(options?.browser);

    const bridge = new CommandBridge();
    const bridgeUrl = await bridge.start();
    const projectRoot = writeCypressProject(bridgeUrl, timeout);
    const cypress = loadCypress();

    const runPromise = cypress
      .run({
        project: projectRoot,
        browser,
        headed: !headless,
        config: {
          defaultCommandTimeout: timeout,
        },
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`Cypress run failed: ${detail}`);
      });

    try {
      await bridge.whenReady(180_000);
    } catch (err) {
      await bridge.shutdown().catch(() => undefined);
      removeCypressProject(projectRoot);
      throw err;
    }

    return new CypressAdapter(bridge, projectRoot, runPromise, timeout);
  }

  private t(opts?: ActionOptions): number {
    return opts?.timeout ?? this.defaultTimeout;
  }

  private locPayload(locator: LocatorRef, opts?: ActionOptions): Record<string, unknown> {
    const loc = resolveCypressLocator(locator);
    return {
      strategy: loc.strategy,
      value: loc.value,
      timeout: this.t(opts),
      label: formatLocatorRef(locator),
    };
  }

  async goto(url: string, opts?: ActionOptions): Promise<void> {
    let target = url;
    if (url.startsWith('file:')) {
      target = materializeFileUrl(this.projectRoot, url);
    }
    await this.bridge.call('goto', { url: target, timeout: this.t(opts) }, this.t(opts) + 30_000);
  }

  async click(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await this.bridge.call('click', this.locPayload(locator, opts), this.t(opts) + 15_000);
  }

  async fill(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void> {
    await this.bridge.call(
      'fill',
      { ...this.locPayload(locator, opts), value },
      this.t(opts) + 15_000,
    );
  }

  async select(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void> {
    await this.bridge.call(
      'select',
      { ...this.locPayload(locator, opts), value },
      this.t(opts) + 15_000,
    );
  }

  async check(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await this.bridge.call('check', this.locPayload(locator, opts), this.t(opts) + 15_000);
  }

  async uncheck(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await this.bridge.call('uncheck', this.locPayload(locator, opts), this.t(opts) + 15_000);
  }

  async wait(locator: LocatorRef, opts?: WaitOptions): Promise<void> {
    await this.bridge.call(
      'wait',
      {
        ...this.locPayload(locator, opts),
        state: opts?.state ?? 'visible',
        timeout: opts?.timeout ?? this.defaultTimeout,
      },
      (opts?.timeout ?? this.defaultTimeout) + 15_000,
    );
  }

  async waitMs(ms: number): Promise<void> {
    await this.bridge.call('waitMs', { ms }, ms + 15_000);
  }

  async screenshot(file: string, opts?: ScreenshotOptions): Promise<void> {
    await this.bridge.call('screenshot', {
      file,
      fullPage: opts?.fullPage ?? false,
    });
  }

  async getText(locator: LocatorRef, opts?: ActionOptions): Promise<string> {
    const v = await this.bridge.call('getText', this.locPayload(locator, opts), this.t(opts) + 15_000);
    return String(v ?? '').trim();
  }

  async getAttr(
    locator: LocatorRef,
    attr: string,
    opts?: ActionOptions,
  ): Promise<string | null> {
    const v = await this.bridge.call(
      'getAttr',
      { ...this.locPayload(locator, opts), attr },
      this.t(opts) + 15_000,
    );
    return v == null ? null : String(v);
  }

  async isVisible(locator: LocatorRef, opts?: ActionOptions): Promise<boolean> {
    const v = await this.bridge.call(
      'isVisible',
      this.locPayload(locator, opts),
      this.t(opts) + 15_000,
    );
    return Boolean(v);
  }

  async getCurrentUrl(): Promise<string> {
    return String(await this.bridge.call('getCurrentUrl', {}, 15_000));
  }

  async scroll(locator: LocatorRef, opts?: ScrollOptions): Promise<void> {
    if (opts?.deltaX != null || opts?.deltaY != null) {
      throw new Error(
        'Cypress adapter MVP: scroll by deltaX/deltaY is not supported (into-view only)',
      );
    }
    await this.bridge.call('scroll', this.locPayload(locator, opts), this.t(opts) + 15_000);
  }

  async swipe(_locator: LocatorRef, _opts?: SwipeOptions): Promise<void> {
    throw new Error('Cypress adapter MVP: swipe is not supported');
  }

  async longPress(_locator: LocatorRef, _opts?: LongPressOptions): Promise<void> {
    throw new Error('Cypress adapter MVP: longPress is not supported');
  }

  async dispose(): Promise<void> {
    // Signal end while the HTTP bridge is still up, wait for Cypress to finish, then drop the port.
    await this.bridge.close().catch(() => undefined);
    await this.runPromise.catch(() => undefined);
    await this.bridge.shutdown().catch(() => undefined);
    removeCypressProject(this.projectRoot);
  }
}

/** Preferred factory export for engine packages. */
export const createAdapter: AdapterFactory = async (options) =>
  CypressAdapter.create(options);

/** Re-export for debugging / tests. */
export { CommandBridge } from './bridge.js';
