import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

/** Primary step verbs (AJV oneOf). Order = preferred split order when keys collide. */
export const PRIMARY_STEP_KEYS = [
  'goto',
  'click',
  'tap',
  'fill',
  'select',
  'check',
  'uncheck',
  'scroll',
  'swipe',
  'long_press',
  'wait',
  'screenshot',
  'assert',
  'soft_assert',
  'api',
  'set',
  'get_text',
  'get_attr',
  'log',
  'debug',
  'if',
  'for',
  'repeat',
  'parallel',
  'do',
  'include',
  'get',
  'post',
  'put',
  'patch',
  'delete',
] as const;

const PRIMARY_SET = new Set<string>(PRIMARY_STEP_KEYS);

/** Sibling keys that belong with a given primary (not separate steps). */
const COMPANIONS: Record<string, readonly string[]> = {
  fill: ['with'],
  select: ['with'],
  get: ['save', 'body', 'headers', 'query'],
  post: ['save', 'body', 'headers', 'query'],
  put: ['save', 'body', 'headers', 'query'],
  patch: ['save', 'body', 'headers', 'query'],
  delete: ['save', 'body', 'headers', 'query'],
  api: ['save', 'body', 'headers', 'method', 'url', 'path'],
  scroll: ['into_view', 'delta_x', 'delta_y'],
  swipe: ['direction', 'distance'],
  long_press: ['duration_ms'],
  get_text: ['save'],
  get_attr: ['save'],
  screenshot: ['path', 'full_page'],
  wait: ['timeout'],
  assert: ['timeout'],
  soft_assert: ['timeout'],
  /** `with` as primary (`with: { engine, steps }`) — rare; keep steps together */
  with: ['steps', 'engine'],
};

const COMMON_KEYS = new Set(['timeout', 'engine', 'debug', 'save']);

const HTTP_PRIMARY = new Set(['get', 'post', 'put', 'patch', 'delete', 'api']);
const UI_PRIMARY = new Set([
  'goto',
  'click',
  'tap',
  'fill',
  'select',
  'check',
  'uncheck',
  'scroll',
  'swipe',
  'long_press',
  'wait',
  'screenshot',
  'get_text',
  'get_attr',
]);

export interface NormalizeResult {
  doc: Record<string, unknown>;
  /** True if any rewrite was applied. */
  changed: boolean;
  fixes: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Expand known LLM aliases into canonical keys on a single step object. */
export function expandStepAliases(
  step: Record<string, unknown>,
): { step: Record<string, unknown>; fixes: string[] } {
  const out: Record<string, unknown> = { ...step };
  const fixes: string[] = [];

  if ('fill+with' in out) {
    const raw = out['fill+with'];
    delete out['fill+with'];
    if (isPlainObject(raw)) {
      const entries = Object.entries(raw);
      if (entries.length === 1) {
        const [k, v] = entries[0]!;
        out.fill = `[data-testid=${k}]`;
        out.with = String(v);
        fixes.push('expand fill+with object');
      } else if (entries.length > 0) {
        // Keep first pair; rest ignored (deterministic, conservative).
        const [k, v] = entries[0]!;
        out.fill = `[data-testid=${k}]`;
        out.with = String(v);
        fixes.push('expand fill+with object (first field)');
      }
    } else if (typeof raw === 'string') {
      out.fill = raw;
      fixes.push('expand fill+with string');
    }
  }

  if ('assert+text' in out) {
    const raw = out['assert+text'];
    delete out['assert+text'];
    out.assert = typeof raw === 'string' ? { text: raw } : raw;
    fixes.push('expand assert+text');
  }

  if ('assert+visible' in out) {
    const raw = out['assert+visible'];
    delete out['assert+visible'];
    if (typeof raw === 'string') {
      out.assert = { text: raw, visible: true };
    } else if (raw === true || raw === false) {
      out.assert = { visible: raw };
    } else {
      out.assert = raw;
    }
    fixes.push('expand assert+visible');
  }

  if ('submit-button' in out) {
    const raw = out['submit-button'];
    delete out['submit-button'];
    out.click =
      typeof raw === 'string' && raw.trim()
        ? `button:has-text("${raw.replace(/"/g, '\\"')}")`
        : 'button[type=submit]';
    fixes.push('map submit-button → click');
  }

  if ('wait-for-page-to-load' in out) {
    delete out['wait-for-page-to-load'];
    if (!('wait' in out) && !('goto' in out)) {
      out.wait = 'body';
      fixes.push('map wait-for-page-to-load → wait');
    } else {
      fixes.push('drop wait-for-page-to-load');
    }
  }

  return { step: out, fixes };
}

/**
 * If a step has multiple primary verbs, split into one step per verb
 * (companions stay with their primary).
 */
export function splitMultiActionStep(
  step: Record<string, unknown>,
): { steps: Record<string, unknown>[]; fixes: string[] } {
  const keys = Object.keys(step);
  const primaries = keys.filter((k) => PRIMARY_SET.has(k));
  if (primaries.length <= 1) {
    return { steps: [step], fixes: [] };
  }

  const common: Record<string, unknown> = {};
  for (const k of keys) {
    if (COMMON_KEYS.has(k) && !PRIMARY_SET.has(k)) {
      // `save` on a mega-step usually belongs to HTTP primary; still copy common timeout/engine/debug
      if (k === 'save') continue;
      common[k] = step[k];
    }
  }

  const usedCompanions = new Set<string>();
  const steps: Record<string, unknown>[] = [];

  for (const primary of primaries) {
    const piece: Record<string, unknown> = { ...common, [primary]: step[primary] };
    const comps = COMPANIONS[primary] ?? [];
    for (const c of comps) {
      if (c in step && !(c in piece)) {
        piece[c] = step[c];
        usedCompanions.add(c);
      }
    }
    // HTTP save often sits as sibling without being listed twice
    if (HTTP_PRIMARY.has(primary) && 'save' in step && !('save' in piece)) {
      piece.save = step.save;
      usedCompanions.add('save');
    }
    steps.push(piece);
  }

  return {
    steps,
    fixes: [`split multi-action step (${primaries.join('+')}) → ${steps.length} steps`],
  };
}

function normalizeStepsArray(
  steps: unknown[],
): { steps: unknown[]; fixes: string[]; changed: boolean } {
  const out: unknown[] = [];
  const fixes: string[] = [];
  let changed = false;

  for (const raw of steps) {
    if (!isPlainObject(raw)) {
      out.push(raw);
      continue;
    }
    const expanded = expandStepAliases(raw);
    if (expanded.fixes.length) {
      changed = true;
      fixes.push(...expanded.fixes);
    }
    const split = splitMultiActionStep(expanded.step);
    if (split.fixes.length) {
      changed = true;
      fixes.push(...split.fixes);
    }
    out.push(...split.steps);
  }

  return { steps: out, fixes, changed };
}

function collectPrimaryKinds(steps: unknown[]): { http: boolean; ui: boolean } {
  let http = false;
  let ui = false;
  for (const s of steps) {
    if (!isPlainObject(s)) continue;
    for (const k of Object.keys(s)) {
      if (HTTP_PRIMARY.has(k)) http = true;
      if (UI_PRIMARY.has(k)) ui = true;
    }
  }
  return { http, ui };
}

/**
 * Deterministic rewrites so AJV oneOf / common LLM mistakes pass more often.
 * Does not invent scenario meaning — only structural cleanup.
 */
export function normalizeNatlDocument(doc: Record<string, unknown>): NormalizeResult {
  const fixes: string[] = [];
  let changed = false;
  const out: Record<string, unknown> = { ...doc };

  // Top-level assertions → steps
  if ('assertions' in out) {
    const assertions = out.assertions;
    delete out.assertions;
    changed = true;
    fixes.push('move top-level assertions → steps');
    const extra: Record<string, unknown>[] = [];
    if (Array.isArray(assertions)) {
      for (const a of assertions) {
        extra.push(isPlainObject(a) && 'assert' in a ? a : { assert: a });
      }
    } else if (assertions !== undefined) {
      extra.push({ assert: assertions });
    }
    const prev = Array.isArray(out.steps) ? [...out.steps] : [];
    out.steps = [...prev, ...extra];
  }

  if (Array.isArray(out.steps)) {
    const norm = normalizeStepsArray(out.steps);
    out.steps = norm.steps;
    if (norm.changed) {
      changed = true;
      fixes.push(...norm.fixes);
    }
  }

  // Infer engine when missing
  if (out.engine === undefined && Array.isArray(out.steps)) {
    const kinds = collectPrimaryKinds(out.steps);
    if (kinds.http && !kinds.ui) {
      out.engine = 'http';
      changed = true;
      fixes.push('infer engine: http');
    } else if (kinds.ui) {
      out.engine = 'playwright';
      changed = true;
      fixes.push('infer engine: playwright');
    }
  }

  // Drop empty name whitespace
  if (typeof out.name === 'string') {
    const trimmed = out.name.trim();
    if (trimmed !== out.name) {
      out.name = trimmed;
      changed = true;
      fixes.push('trim name');
    }
  }

  return { doc: out, changed, fixes };
}

/** Parse YAML/JSON-ish document string, normalize, re-stringify YAML. */
export function normalizeNatlYaml(source: string): {
  yaml: string;
  changed: boolean;
  fixes: string[];
} {
  let doc: unknown;
  try {
    doc = parseYaml(source);
  } catch {
    return { yaml: source, changed: false, fixes: [] };
  }
  if (!isPlainObject(doc)) {
    return { yaml: source, changed: false, fixes: [] };
  }
  const result = normalizeNatlDocument(doc);
  if (!result.changed) {
    return { yaml: source, changed: false, fixes: [] };
  }
  return {
    yaml: stringifyYaml(result.doc, { lineWidth: 100 }).trimEnd(),
    changed: true,
    fixes: result.fixes,
  };
}
