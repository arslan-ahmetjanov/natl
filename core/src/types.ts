/** Normalized NATL AST types */

export type WaitState = 'visible' | 'hidden' | 'attached' | 'detached';

export type AssertKind =
  | 'text'
  | 'contains'
  | 'visible'
  | 'hidden'
  | 'attr'
  | 'url'
  | 'expr';

export type LogLevel = 'info' | 'debug' | 'warn' | 'error';

export interface NatFileMeta {
  name?: string;
  /** Labels for CLI `--tags` filtering (OR match) */
  tags?: string[];
  engine?: string;
  timeout?: number;
  /** Extra full-scenario attempts after the first failure (default 0) */
  retries?: number;
  vars?: Record<string, unknown>;
  secrets?: SecretsConfig;
  imports?: string[];
  data?: unknown[];
  /** Implicit data-driven rows: each object is merged into vars and steps run once */
  cases?: Record<string, unknown>[];
  before_each?: Step[];
  after_each?: Step[];
  steps: Step[];
  /**
   * Default locator strategy for string `elements` / inline selectors on this file
   * (overrides project `locator_strategy` when set).
   */
  locator_strategy?: string;
  /** Page Object style elements: CSS string or `{ strategy, value }` */
  elements?: Record<string, string | { strategy?: string; value: string }>;
  /** Page Object style named actions */
  actions?: Record<string, Step[]>;
  /** Absolute path of the source file */
  sourcePath?: string;
}

export interface SecretsConfig {
  env?: {
    file?: string;
    encoding?: string;
  };
}

export type Step =
  | GotoStep
  | ClickStep
  | FillStep
  | SelectStep
  | CheckStep
  | UncheckStep
  | ScrollStep
  | SwipeStep
  | LongPressStep
  | WaitStep
  | ScreenshotStep
  | AssertStep
  | ApiStep
  | SetStep
  | GetTextStep
  | GetAttrStep
  | LogStep
  | DebugStep
  | IfStep
  | ForStep
  | RepeatStep
  | ParallelStep
  | IncludeStep
  | DoStep
  | WithStep;

export interface BaseStep {
  engine?: string;
  timeout?: number;
  save?: string;
  debug?: boolean;
  /** Approximate 1-based line in the source YAML (if known) */
  line?: number;
}

/** Switch engine for nested steps (e.g. `with: http`). */
export interface WithStep extends BaseStep {
  type: 'with';
  engine: string;
  steps: Step[];
}

export interface GotoStep extends BaseStep {
  type: 'goto';
  url: string;
}

export interface ClickStep extends BaseStep {
  type: 'click';
  locator: string;
}

export interface FillStep extends BaseStep {
  type: 'fill';
  locator: string;
  with: string;
}

export interface SelectStep extends BaseStep {
  type: 'select';
  locator: string;
  with: string;
}

export interface CheckStep extends BaseStep {
  type: 'check';
  locator: string;
}

export interface UncheckStep extends BaseStep {
  type: 'uncheck';
  locator: string;
}

export interface ScrollStep extends BaseStep {
  type: 'scroll';
  locator: string;
  /** Scroll target into view (default true when no deltas). */
  intoView?: boolean;
  deltaX?: number;
  deltaY?: number;
}

export interface SwipeStep extends BaseStep {
  type: 'swipe';
  locator: string;
  direction: 'left' | 'right' | 'up' | 'down';
  distance?: number;
}

export interface LongPressStep extends BaseStep {
  type: 'long_press';
  locator: string;
  /** Hold duration in ms */
  durationMs?: number;
}

export interface WaitStep extends BaseStep {
  type: 'wait';
  selector?: string;
  state?: WaitState;
  ms?: number;
}

export interface ScreenshotStep extends BaseStep {
  type: 'screenshot';
  file: string;
  fullPage?: boolean;
}

export interface AssertStep extends BaseStep {
  type: 'assert';
  kind: AssertKind;
  locator?: string;
  expected?: string;
  attr?: string;
  operator?: string;
  expression?: string;
  /** When true, failure is recorded and the scenario continues */
  soft?: boolean;
}

export interface ApiStep extends BaseStep {
  type: 'api';
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface SetStep extends BaseStep {
  type: 'set';
  expression: string;
}

export interface GetTextStep extends BaseStep {
  type: 'get_text';
  locator: string;
}

export interface GetAttrStep extends BaseStep {
  type: 'get_attr';
  locator: string;
  attr: string;
}

export interface LogStep extends BaseStep {
  type: 'log';
  message: string;
  level: LogLevel;
}

export interface DebugStep extends BaseStep {
  type: 'debug';
  enabled: boolean;
}

export interface IfStep extends BaseStep {
  type: 'if';
  condition: string;
  then: Step[];
  else?: Step[];
}

export interface ForStep extends BaseStep {
  type: 'for';
  variable: string;
  iterable: string;
  steps: Step[];
}

export interface RepeatStep extends BaseStep {
  type: 'repeat';
  times?: number;
  until?: string;
  steps: Step[];
}

export interface ParallelStep extends BaseStep {
  type: 'parallel';
  wait?: 'all' | 'any';
  steps: Step[];
}

export interface IncludeStep extends BaseStep {
  type: 'include';
  file?: string;
  action?: string;
  vars?: Record<string, unknown>;
}

/** POM action call: `do: page.action` with sibling arg keys. */
export interface DoStep extends BaseStep {
  type: 'do';
  /** `page.action` or unambiguous `action` */
  target: string;
  vars?: Record<string, unknown>;
}
