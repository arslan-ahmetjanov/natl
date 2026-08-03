import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type BrowserType,
  type Page,
} from 'playwright';
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
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Locator } from 'playwright';
/** Matches `@natl/core` ArtifactMode. */
type ArtifactMode = 'off' | 'on' | 'on-fail';

interface FinalizeArtifactsOptions {
  ok: boolean;
  artifactsDir: string;
  baseName: string;
}

interface FinalizeArtifactsResult {
  tracePath?: string;
  videoPath?: string;
}

/** Stable engine id used in YAML `engine:` and CLI `--engine`. */
export const engine = 'playwright' as const;

const BROWSER_TYPES: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

/** Resolve Playwright browser type; unknown ids throw (no silent fallback). */
export function resolvePlaywrightBrowser(browser?: string): BrowserType {
  const key = (browser ?? 'chromium').trim().toLowerCase();
  const type = BROWSER_TYPES[key];
  if (!type) {
    throw new Error(
      `Playwright adapter does not support browser "${browser}". ` +
        `Supported: ${Object.keys(BROWSER_TYPES).join(', ')}. ` +
        `Install with: npx playwright install ${key || 'chromium'}`,
    );
  }
  return type;
}

/** Map NATL LocatorRef → Playwright locator; unknown strategy throws. */
export function resolvePlaywrightLocator(page: Page, locator: LocatorRef): Locator {
  const strategy = locator.strategy.trim().toLowerCase();
  if (strategy === 'css') {
    return page.locator(locator.value);
  }
  if (strategy === 'xpath') {
    const value = locator.value.startsWith('xpath=')
      ? locator.value
      : `xpath=${locator.value}`;
    return page.locator(value);
  }
  throw new Error(
    `Playwright adapter does not support locator strategy "${locator.strategy}". ` +
      `Supported: css, xpath`,
  );
}

export class PlaywrightAdapter implements EngineAdapter {
  private pageClosed = false;

  private constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly page: Page,
    private readonly defaultTimeout: number,
    private readonly trace: ArtifactMode,
    private readonly video: ArtifactMode,
    private readonly videoTempDir: string | undefined,
  ) {}

  static async create(options?: AdapterFactoryOptions): Promise<PlaywrightAdapter> {
    const timeout = options?.timeout ?? 10000;
    const headless = options?.headless ?? true;
    const trace = options?.trace ?? 'off';
    const video = options?.video ?? 'off';

    const browserType = resolvePlaywrightBrowser(options?.browser);
    const browser = await browserType.launch({ headless });

    const contextOptions: BrowserContextOptions = {};
    if (options?.viewport) {
      contextOptions.viewport = {
        width: options.viewport.width,
        height: options.viewport.height,
      };
    }

    let videoTempDir: string | undefined;
    if (video !== 'off') {
      videoTempDir = join(tmpdir(), `natl-video-${randomUUID()}`);
      mkdirSync(videoTempDir, { recursive: true });
      contextOptions.recordVideo = { dir: videoTempDir };
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    if (trace !== 'off') {
      await context.tracing.start({ screenshots: true, snapshots: true });
    }

    return new PlaywrightAdapter(browser, context, page, timeout, trace, video, videoTempDir);
  }

  private t(opts?: ActionOptions): number {
    return opts?.timeout ?? this.defaultTimeout;
  }

  private loc(locator: LocatorRef): Locator {
    return resolvePlaywrightLocator(this.page, locator);
  }

  async goto(url: string, opts?: ActionOptions): Promise<void> {
    await this.page.goto(url, { timeout: this.t(opts), waitUntil: 'domcontentloaded' });
  }

  async click(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await this.loc(locator).click({ timeout: this.t(opts) });
  }

  async fill(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void> {
    await this.loc(locator).fill(value, { timeout: this.t(opts) });
  }

  async select(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void> {
    await this.loc(locator).selectOption(value, { timeout: this.t(opts) });
  }

  async check(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await this.loc(locator).check({ timeout: this.t(opts) });
  }

  async uncheck(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await this.loc(locator).uncheck({ timeout: this.t(opts) });
  }

  async wait(locator: LocatorRef, opts?: WaitOptions): Promise<void> {
    const state = opts?.state ?? 'visible';
    await this.loc(locator).waitFor({
      state,
      timeout: opts?.timeout ?? this.defaultTimeout,
    });
  }

  async waitMs(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async screenshot(file: string, opts?: ScreenshotOptions): Promise<void> {
    mkdirSync(dirname(file), { recursive: true });
    await this.page.screenshot({ path: file, fullPage: opts?.fullPage ?? false });
  }

  async getText(locator: LocatorRef, opts?: ActionOptions): Promise<string> {
    return (await this.loc(locator).innerText({ timeout: this.t(opts) })).trim();
  }

  async getAttr(
    locator: LocatorRef,
    attr: string,
    opts?: ActionOptions,
  ): Promise<string | null> {
    return this.loc(locator).getAttribute(attr, { timeout: this.t(opts) });
  }

  async isVisible(locator: LocatorRef, opts?: ActionOptions): Promise<boolean> {
    try {
      await this.loc(locator).waitFor({
        state: 'visible',
        timeout: this.t(opts),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async scroll(locator: LocatorRef, opts?: ScrollOptions): Promise<void> {
    const target = this.loc(locator);
    await target.waitFor({ state: 'attached', timeout: this.t(opts) });
    const intoView = opts?.intoView !== false && opts?.deltaX === undefined && opts?.deltaY === undefined;
    if (intoView) {
      await target.scrollIntoViewIfNeeded({ timeout: this.t(opts) });
      return;
    }
    const dx = opts?.deltaX ?? 0;
    const dy = opts?.deltaY ?? 0;
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`scroll: cannot resolve bounding box for "${formatLocatorRef(locator)}"`);
    }
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.wheel(dx, dy);
  }

  async swipe(locator: LocatorRef, opts?: SwipeOptions): Promise<void> {
    if (!opts?.direction) {
      throw new Error('swipe: "direction" is required (left | right | up | down)');
    }
    const target = this.loc(locator);
    await target.waitFor({ state: 'visible', timeout: this.t(opts) });
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`swipe: cannot resolve bounding box for "${formatLocatorRef(locator)}"`);
    }
    const distance = opts.distance ?? Math.min(box.width, box.height, 120);
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height / 2;
    let x1 = x0;
    let y1 = y0;
    switch (opts.direction) {
      case 'left':
        x1 = x0 - distance;
        break;
      case 'right':
        x1 = x0 + distance;
        break;
      case 'up':
        y1 = y0 - distance;
        break;
      case 'down':
        y1 = y0 + distance;
        break;
      default:
        throw new Error(
          `swipe: unsupported direction "${String(opts.direction)}" (left | right | up | down)`,
        );
    }
    await this.page.mouse.move(x0, y0);
    await this.page.mouse.down();
    await this.page.mouse.move(x1, y1, { steps: 8 });
    await this.page.mouse.up();
  }

  async longPress(locator: LocatorRef, opts?: LongPressOptions): Promise<void> {
    const durationMs = opts?.durationMs ?? 800;
    const target = this.loc(locator);
    await target.waitFor({ state: 'visible', timeout: this.t(opts) });
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`longPress: cannot resolve bounding box for "${formatLocatorRef(locator)}"`);
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.waitForTimeout(durationMs);
    await this.page.mouse.up();
  }

  async finalizeArtifacts(opts: FinalizeArtifactsOptions): Promise<FinalizeArtifactsResult> {
    const result: FinalizeArtifactsResult = {};
    const wantTrace = this.trace === 'on' || (this.trace === 'on-fail' && !opts.ok);
    const wantVideo = this.video === 'on' || (this.video === 'on-fail' && !opts.ok);

    mkdirSync(opts.artifactsDir, { recursive: true });

    if (this.trace !== 'off') {
      if (wantTrace) {
        const tracePath = join(opts.artifactsDir, `${opts.baseName}.zip`);
        await this.context.tracing.stop({ path: tracePath });
        result.tracePath = tracePath;
      } else {
        await this.context.tracing.stop();
      }
    }

    if (this.video !== 'off') {
      const video = this.page.video();
      if (!this.pageClosed) {
        await this.page.close();
        this.pageClosed = true;
      }
      if (video) {
        if (wantVideo) {
          const videoPath = join(opts.artifactsDir, `${opts.baseName}.webm`);
          await video.saveAs(videoPath);
          result.videoPath = videoPath;
        }
        await video.delete().catch(() => undefined);
      }
      if (this.videoTempDir) {
        rmSync(this.videoTempDir, { recursive: true, force: true });
      }
    }

    return result;
  }

  async dispose(): Promise<void> {
    if (!this.pageClosed) {
      await this.page.close().catch(() => undefined);
      this.pageClosed = true;
    }
    await this.context.close().catch(() => undefined);
    await this.browser.close().catch(() => undefined);
    if (this.videoTempDir) {
      rmSync(this.videoTempDir, { recursive: true, force: true });
    }
  }
}

/** Preferred factory export for engine packages. */
export const createAdapter: AdapterFactory = async (options) =>
  PlaywrightAdapter.create(options);

/** @deprecated Prefer `createAdapter` */
export const createPlaywrightAdapter = createAdapter;
