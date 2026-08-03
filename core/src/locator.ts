import type { LocatorRef } from './adapter.js';

/** Raw element entry in YAML (before normalize). */
export type ElementDef = string | { strategy?: string; value: string };

/** Default when config / page omit `locator_strategy`. */
export const DEFAULT_LOCATOR_STRATEGY = 'css';

/**
 * Built-in web strategies (extensible string — adapters may add more).
 * Core does not reject unknown strategies; the adapter does.
 */
export const WEB_LOCATOR_STRATEGIES = ['css', 'xpath'] as const;

export type WebLocatorStrategy = (typeof WEB_LOCATOR_STRATEGIES)[number];

export function isLocatorRef(v: unknown): v is LocatorRef {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof (v as LocatorRef).strategy === 'string' &&
    typeof (v as LocatorRef).value === 'string'
  );
}

export function normalizeElementDef(
  name: string,
  raw: unknown,
  defaultStrategy: string,
): LocatorRef {
  if (typeof raw === 'string') {
    return { strategy: defaultStrategy, value: raw };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (typeof o.value !== 'string') {
      throw new Error(`elements.${name}: object form requires string "value"`);
    }
    const strategy =
      typeof o.strategy === 'string' && o.strategy.trim()
        ? o.strategy.trim()
        : defaultStrategy;
    return { strategy, value: o.value };
  }
  throw new Error(
    `elements.${name}: expected string or { strategy, value }, got ${typeof raw}`,
  );
}

export function normalizeElementsMap(
  elements: Record<string, unknown> | undefined,
  defaultStrategy: string,
): Record<string, LocatorRef> {
  if (!elements) return {};
  const out: Record<string, LocatorRef> = {};
  for (const [k, v] of Object.entries(elements)) {
    out[k] = normalizeElementDef(k, v, defaultStrategy);
  }
  return out;
}

/**
 * Resolve a step locator field (`$email`, `#css`, …) to {@link LocatorRef}.
 * Exact `$name` refs prefer stored LocatorRef objects (POM elements).
 */
export function resolveLocator(
  raw: string,
  opts: {
    get: (path: string) => unknown;
    interpolate: (s: string) => string;
    defaultStrategy: string;
  },
): LocatorRef {
  const trimmed = raw.trim();
  const exact = /^\$([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)$/.exec(trimmed);
  if (exact) {
    const val = opts.get(exact[1]);
    if (isLocatorRef(val)) return val;
    if (typeof val === 'string') {
      return { strategy: opts.defaultStrategy, value: val };
    }
    if (val === undefined) {
      return { strategy: opts.defaultStrategy, value: trimmed };
    }
    throw new Error(
      `Locator $${exact[1]} must be a string or { strategy, value }, got ${typeof val}`,
    );
  }
  return { strategy: opts.defaultStrategy, value: opts.interpolate(raw) };
}

/** Human-readable locator for logs / errors. */
export function formatLocatorRef(loc: LocatorRef): string {
  if (loc.strategy === 'css') return loc.value;
  return `${loc.strategy}:${loc.value}`;
}
