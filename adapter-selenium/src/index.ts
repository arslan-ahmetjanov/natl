import { Builder, By, until, type WebDriver, type WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';
import edge from 'selenium-webdriver/edge.js';
import type {
  ActionOptions,
  AdapterFactory,
  AdapterFactoryOptions,
  ArtifactMode,
  EngineAdapter,
  FinalizeArtifactsOptions,
  FinalizeArtifactsResult,
  LocatorRef,
  LongPressOptions,
  ScreenshotOptions,
  ScrollOptions,
  SwipeOptions,
  WaitOptions,
} from '@natl/core';
import { formatLocatorRef } from '@natl/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Stable engine id used in YAML `engine:` and CLI `--engine`. */
export const engine = 'selenium' as const;

const SUPPORTED_BROWSERS = ['chrome', 'chromium', 'firefox', 'edge'] as const;
export type SeleniumBrowser = (typeof SUPPORTED_BROWSERS)[number];

type CdpDriver = WebDriver & {
  executeCdpCommand?: (cmd: string, params: Record<string, unknown>) => Promise<{ data?: string }>;
};

/**
 * Message when Selenium would have been asked to keep Playwright-style artifacts.
 * Used by finalizeArtifacts and unit tests.
 */
export function describeUnsupportedSeleniumArtifacts(
  trace: ArtifactMode,
  video: ArtifactMode,
  ok: boolean,
): string | undefined {
  const wantTrace = trace === 'on' || (trace === 'on-fail' && !ok);
  const wantVideo = video === 'on' || (video === 'on-fail' && !ok);
  const parts: string[] = [];
  if (wantTrace) parts.push('trace (.zip)');
  if (wantVideo) parts.push('video (.webm)');
  if (!parts.length) return undefined;
  return (
    `Selenium adapter cannot save ${parts.join(' / ')} — ` +
    `use Playwright for Trace Viewer / video, or set trace/video to off.`
  );
}

/** Normalize browser id; `chromium` → Chrome. Unknown ids throw. */
export function resolveSeleniumBrowser(browser?: string): SeleniumBrowser {
  const key = (browser ?? 'chrome').trim().toLowerCase();
  if (key === 'chromium') return 'chrome';
  if ((SUPPORTED_BROWSERS as readonly string[]).includes(key)) {
    return key as SeleniumBrowser;
  }
  throw new Error(
    `Selenium adapter does not support browser "${browser}". ` +
      `Supported: chrome (alias chromium), firefox, edge. ` +
      `Selenium Manager downloads drivers automatically; for Grid set SELENIUM_REMOTE_URL.`,
  );
}

/** Map NATL LocatorRef → Selenium By; unknown strategy throws. */
export function resolveSeleniumBy(locator: LocatorRef): By {
  const strategy = locator.strategy.trim().toLowerCase();
  if (strategy === 'css') {
    return By.css(locator.value);
  }
  if (strategy === 'xpath') {
    const value = locator.value.startsWith('xpath=')
      ? locator.value.slice('xpath='.length)
      : locator.value;
    return By.xpath(value);
  }
  throw new Error(
    `Selenium adapter does not support locator strategy "${locator.strategy}". ` +
      `Supported: css, xpath`,
  );
}

function driverErrorHint(err: unknown): Error {
  const detail = err instanceof Error ? err.message : String(err);
  return new Error(
    `Selenium WebDriver failed to start.\n` +
      `Ensure Chrome/Firefox/Edge is installed (Selenium Manager fetches the driver).\n` +
      `For a remote Grid: set SELENIUM_REMOTE_URL (e.g. http://localhost:4444/wd/hub).\n` +
      `(${detail})`,
  );
}

export class SeleniumAdapter implements EngineAdapter {
  private constructor(
    private readonly driver: WebDriver,
    private readonly defaultTimeout: number,
    private readonly browser: SeleniumBrowser,
    private readonly trace: ArtifactMode,
    private readonly video: ArtifactMode,
  ) {}

  static async create(options?: AdapterFactoryOptions): Promise<SeleniumAdapter> {
    const timeout = options?.timeout ?? 10000;
    const headless = options?.headless ?? true;
    const browser = resolveSeleniumBrowser(options?.browser);
    const trace = options?.trace ?? 'off';
    const video = options?.video ?? 'off';
    const remoteUrl =
      process.env.SELENIUM_REMOTE_URL?.trim() ||
      process.env.SELENIUM_GRID_URL?.trim() ||
      undefined;

    let builder = new Builder();
    if (remoteUrl) {
      builder = builder.usingServer(remoteUrl);
    }

    try {
      if (browser === 'chrome') {
        const opts = new chrome.Options();
        if (headless) opts.addArguments('--headless=new', '--disable-gpu');
        opts.addArguments('--window-size=1280,720');
        if (options?.viewport) {
          opts.addArguments(`--window-size=${options.viewport.width},${options.viewport.height}`);
        }
        builder = builder.forBrowser('chrome').setChromeOptions(opts);
      } else if (browser === 'firefox') {
        const opts = new firefox.Options();
        if (headless) opts.addArguments('-headless');
        if (options?.viewport) {
          opts.windowSize({
            width: options.viewport.width,
            height: options.viewport.height,
          });
        }
        builder = builder.forBrowser('firefox').setFirefoxOptions(opts);
      } else {
        const opts = new edge.Options();
        if (headless) opts.addArguments('--headless=new', '--disable-gpu');
        if (options?.viewport) {
          opts.addArguments(`--window-size=${options.viewport.width},${options.viewport.height}`);
        }
        builder = builder.forBrowser('MicrosoftEdge').setEdgeOptions(opts);
      }

      const driver = await builder.build();
      await driver.manage().setTimeouts({ implicit: 0, pageLoad: timeout, script: timeout });
      return new SeleniumAdapter(driver, timeout, browser, trace, video);
    } catch (err) {
      throw driverErrorHint(err);
    }
  }

  private t(opts?: ActionOptions): number {
    return opts?.timeout ?? this.defaultTimeout;
  }

  private by(locator: LocatorRef): By {
    return resolveSeleniumBy(locator);
  }

  private async findReady(locator: LocatorRef, timeout: number): Promise<WebElement> {
    const by = this.by(locator);
    const el = await this.driver.wait(until.elementLocated(by), timeout, `locate ${formatLocatorRef(locator)}`);
    await this.driver.wait(until.elementIsVisible(el), timeout, `visible ${formatLocatorRef(locator)}`);
    await this.driver.wait(until.elementIsEnabled(el), timeout, `enabled ${formatLocatorRef(locator)}`);
    return el;
  }

  private async findAttached(locator: LocatorRef, timeout: number): Promise<WebElement> {
    const by = this.by(locator);
    return this.driver.wait(until.elementLocated(by), timeout, `locate ${formatLocatorRef(locator)}`);
  }

  async goto(url: string, opts?: ActionOptions): Promise<void> {
    const prev = await this.driver.manage().getTimeouts();
    await this.driver.manage().setTimeouts({ ...prev, pageLoad: this.t(opts) });
    try {
      await this.driver.get(url);
    } finally {
      await this.driver.manage().setTimeouts(prev);
    }
  }

  async click(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    await (await this.findReady(locator, this.t(opts))).click();
  }

  async fill(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void> {
    const el = await this.findReady(locator, this.t(opts));
    await el.clear();
    await el.sendKeys(value);
  }

  async select(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void> {
    const el = await this.findReady(locator, this.t(opts));
    const options = await el.findElements(By.css('option'));
    for (const opt of options) {
      const v = await opt.getAttribute('value');
      const text = (await opt.getText()).trim();
      if (v === value || text === value) {
        await opt.click();
        return;
      }
    }
    throw new Error(
      `select: no option "${value}" for "${formatLocatorRef(locator)}"`,
    );
  }

  async check(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    const el = await this.findReady(locator, this.t(opts));
    if (!(await el.isSelected())) await el.click();
  }

  async uncheck(locator: LocatorRef, opts?: ActionOptions): Promise<void> {
    const el = await this.findReady(locator, this.t(opts));
    if (await el.isSelected()) await el.click();
  }

  async wait(locator: LocatorRef, opts?: WaitOptions): Promise<void> {
    const timeout = opts?.timeout ?? this.defaultTimeout;
    const state = opts?.state ?? 'visible';
    const by = this.by(locator);
    if (state === 'attached') {
      await this.driver.wait(until.elementLocated(by), timeout);
      return;
    }
    if (state === 'visible') {
      const el = await this.driver.wait(until.elementLocated(by), timeout);
      await this.driver.wait(until.elementIsVisible(el), timeout);
      return;
    }
    if (state === 'hidden') {
      try {
        const el = await this.driver.findElement(by);
        await this.driver.wait(until.elementIsNotVisible(el), timeout);
      } catch {
        // already absent / not found → hidden
      }
      return;
    }
    if (state === 'detached') {
      await this.driver.wait(async () => {
        const found = await this.driver.findElements(by);
        return found.length === 0;
      }, timeout);
      return;
    }
    throw new Error(`Selenium adapter: unsupported wait state "${String(state)}"`);
  }

  async waitMs(ms: number): Promise<void> {
    await this.driver.sleep(ms);
  }

  async screenshot(file: string, opts?: ScreenshotOptions): Promise<void> {
    mkdirSync(dirname(file), { recursive: true });
    if (opts?.fullPage) {
      const cdp = await this.tryCdpFullPagePng();
      if (cdp) {
        writeFileSync(file, Buffer.from(cdp, 'base64'));
        return;
      }
    }
    const b64 = await this.driver.takeScreenshot();
    writeFileSync(file, Buffer.from(b64, 'base64'));
  }

  /**
   * Chromium CDP full-page capture when available (Chrome / Edge).
   * Returns undefined on Firefox or when CDP is unavailable.
   */
  private async tryCdpFullPagePng(): Promise<string | undefined> {
    if (this.browser !== 'chrome' && this.browser !== 'edge') return undefined;
    const driver = this.driver as CdpDriver;
    if (typeof driver.executeCdpCommand !== 'function') return undefined;
    try {
      const result = await driver.executeCdpCommand('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true,
      });
      return typeof result?.data === 'string' ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Explicit no-op for Playwright-style trace/video with a clear warn when
   * artifacts would have been kept. Fail screenshots still use `screenshot`.
   */
  async finalizeArtifacts(opts: FinalizeArtifactsOptions): Promise<FinalizeArtifactsResult> {
    const msg = describeUnsupportedSeleniumArtifacts(this.trace, this.video, opts.ok);
    if (msg) {
      // eslint-disable-next-line no-console
      console.warn(`[natl/adapter-selenium] ${msg}`);
    }
    return {};
  }

  async getText(locator: LocatorRef, opts?: ActionOptions): Promise<string> {
    const el = await this.findReady(locator, this.t(opts));
    return (await el.getText()).trim();
  }

  async getAttr(
    locator: LocatorRef,
    attr: string,
    opts?: ActionOptions,
  ): Promise<string | null> {
    const el = await this.findAttached(locator, this.t(opts));
    return el.getAttribute(attr);
  }

  async isVisible(locator: LocatorRef, opts?: ActionOptions): Promise<boolean> {
    try {
      await this.wait(locator, { state: 'visible', timeout: this.t(opts) });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentUrl(): Promise<string> {
    return this.driver.getCurrentUrl();
  }

  async scroll(locator: LocatorRef, opts?: ScrollOptions): Promise<void> {
    const el = await this.findAttached(locator, this.t(opts));
    const intoView =
      opts?.intoView !== false && opts?.deltaX === undefined && opts?.deltaY === undefined;
    if (intoView) {
      await this.driver.executeScript(
        'arguments[0].scrollIntoView({ block: "center", inline: "nearest" });',
        el,
      );
      return;
    }
    const dx = opts?.deltaX ?? 0;
    const dy = opts?.deltaY ?? 0;
    await this.driver.executeScript('window.scrollBy(arguments[0], arguments[1]);', dx, dy);
  }

  async swipe(locator: LocatorRef, opts?: SwipeOptions): Promise<void> {
    if (!opts?.direction) {
      throw new Error('swipe: "direction" is required (left | right | up | down)');
    }
    const el = await this.findReady(locator, this.t(opts));
    const rect = await el.getRect();
    const distance = opts.distance ?? Math.min(rect.width, rect.height, 120);
    const x0 = rect.x + rect.width / 2;
    const y0 = rect.y + rect.height / 2;
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
    const actions = this.driver.actions({ async: true });
    await actions
      .move({ x: Math.round(x0), y: Math.round(y0) })
      .press()
      .move({ x: Math.round(x1), y: Math.round(y1), duration: 200 })
      .release()
      .perform();
  }

  async longPress(locator: LocatorRef, opts?: LongPressOptions): Promise<void> {
    const durationMs = opts?.durationMs ?? 800;
    const el = await this.findReady(locator, this.t(opts));
    const rect = await el.getRect();
    const x = Math.round(rect.x + rect.width / 2);
    const y = Math.round(rect.y + rect.height / 2);
    const actions = this.driver.actions({ async: true });
    await actions.move({ x, y }).press().pause(durationMs).release().perform();
  }

  async dispose(): Promise<void> {
    await this.driver.quit().catch(() => undefined);
  }
}

/** Preferred factory export for engine packages. */
export const createAdapter: AdapterFactory = async (options) =>
  SeleniumAdapter.create(options);
