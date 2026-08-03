/** Engine adapter contract — Strategy pattern for UI engines (v2). */

export type ArtifactMode = 'off' | 'on' | 'on-fail';

export interface WaitOptions {
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeout?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
}

export interface ActionOptions {
  timeout?: number;
}

/** Scroll: into view (default) or by pixel deltas. */
export interface ScrollOptions extends ActionOptions {
  intoView?: boolean;
  deltaX?: number;
  deltaY?: number;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeOptions extends ActionOptions {
  direction: SwipeDirection;
  /** Gesture distance in CSS pixels (adapter default if omitted). */
  distance?: number;
}

export interface LongPressOptions extends ActionOptions {
  /** Hold duration in ms (adapter default if omitted). */
  durationMs?: number;
}

/**
 * Resolved locator passed to adapters.
 * Strategy is opaque to core (web today: `css` | `xpath`; more per adapter later).
 */
export interface LocatorRef {
  strategy: string;
  value: string;
}

export interface FinalizeArtifactsOptions {
  ok: boolean;
  /** Absolute directory for artifacts */
  artifactsDir: string;
  /** Filename stem without extension (e.g. stamp-label-attempt-1) */
  baseName: string;
}

export interface FinalizeArtifactsResult {
  tracePath?: string;
  videoPath?: string;
}

/**
 * Options passed to an adapter factory when opening a UI session.
 * Core does **not** validate `browser` — each adapter defines its own ids
 * (e.g. Playwright: `chromium` | `firefox` | `webkit`).
 */
export interface AdapterFactoryOptions {
  timeout?: number;
  headless?: boolean;
  /** Adapter-specific browser / channel id (opaque string to core). */
  browser?: string;
  /** Optional viewport hint for the session. */
  viewport?: { width: number; height: number };
  trace?: ArtifactMode;
  video?: ArtifactMode;
}

/**
 * Engine adapter contract — Strategy pattern for UI engines.
 *
 * Neutral **web UI surface** (no Playwright-specific method names).
 * Gestures (`scroll` / `swipe` / `longPress`) are part of the contract;
 * YAML steps land in task 16. Unsupported capabilities must throw a clear
 * error — never silent no-op.
 *
 * **Auto-wait:** locator actions (`click`, `fill`, `select`, `check`, `uncheck`,
 * gestures) and reads used by asserts (`getText`, `getAttr`, `isVisible`) must
 * wait until the target is ready within `opts.timeout` (or the adapter default).
 * Callers should not need a preceding `wait: … visible` for the same target.
 * Explicit `wait` / `waitMs` remain for hidden, delay, or non-default states.
 */
export interface EngineAdapter {
  goto(url: string, opts?: ActionOptions): Promise<void>;
  /** Waits until the target is actionable, then clicks. (`tap` in YAML maps here.) */
  click(locator: LocatorRef, opts?: ActionOptions): Promise<void>;
  /** Waits until the target is editable, then fills. */
  fill(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void>;
  select(locator: LocatorRef, value: string, opts?: ActionOptions): Promise<void>;
  check(locator: LocatorRef, opts?: ActionOptions): Promise<void>;
  uncheck(locator: LocatorRef, opts?: ActionOptions): Promise<void>;
  /** Explicit wait for a selector state (default visible). Prefer auto-wait on actions/assert when possible. */
  wait(locator: LocatorRef, opts?: WaitOptions): Promise<void>;
  waitMs(ms: number): Promise<void>;
  screenshot(file: string, opts?: ScreenshotOptions): Promise<void>;
  /** Waits until the target can yield text (used by assert text/contains). */
  getText(locator: LocatorRef, opts?: ActionOptions): Promise<string>;
  getAttr(locator: LocatorRef, attr: string, opts?: ActionOptions): Promise<string | null>;
  /**
   * Waits up to timeout for the target to become visible; returns false if it does not.
   * Used by assert visible / hidden.
   */
  isVisible(locator: LocatorRef, opts?: ActionOptions): Promise<boolean>;
  getCurrentUrl(): Promise<string>;
  /** Scroll target into view (default) or by deltas. */
  scroll(locator: LocatorRef, opts?: ScrollOptions): Promise<void>;
  /** Swipe / drag gesture starting at the target. */
  swipe(locator: LocatorRef, opts?: SwipeOptions): Promise<void>;
  /** Press and hold on the target. */
  longPress(locator: LocatorRef, opts?: LongPressOptions): Promise<void>;
  /**
   * Persist or discard engine-specific artifacts (trace / video).
   * Optional — adapters without tracing may omit it.
   */
  finalizeArtifacts?(opts: FinalizeArtifactsOptions): Promise<FinalizeArtifactsResult>;
  dispose(): Promise<void>;
}

export type AdapterFactory = (options?: AdapterFactoryOptions) => Promise<EngineAdapter>;
