import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { parseDocument, LineCounter, isMap, isSeq, type YAMLMap, type YAMLSeq } from 'yaml';
import { z } from 'zod';
import { preprocessNatlSourceWithMap } from './preprocess.js';
import type {
  AssertStep,
  NatFileMeta,
  Step,
  WaitState,
} from './types.js';
import type { SwipeDirection } from './adapter.js';

const WaitStateSchema = z.enum(['visible', 'hidden', 'attached', 'detached']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Parse "fill: #email with: $user" style keys from a single-key object */
function getPrimaryKey(obj: Record<string, unknown>): string | undefined {
  const keys = Object.keys(obj).filter(
    (k) =>
      ![
        'with',
        'timeout',
        'engine',
        'save',
        'debug',
        'then',
        'else',
        'steps',
        'vars',
        'file',
        'method',
        'url',
        'headers',
        'body',
        'level',
        'message',
        'full_page',
        'attr',
        'state',
        'selector',
        'locator',
        'wait',
        'times',
        'until',
        'text',
        'visible',
        'hidden',
        'soft',
        'contains',
        'is',
        'into_view',
        'direction',
        'distance',
        'duration_ms',
        'delta_x',
        'delta_y',
        'steps',
        'direction',
      ].includes(k),
  );
  return keys[0];
}

function normalizeWait(raw: Record<string, unknown> | string | number): Step {
  if (typeof raw === 'number') {
    return { type: 'wait', ms: raw };
  }
  if (typeof raw === 'string') {
    // "2000 ms" or ".dashboard visible"
    const msMatch = raw.match(/^(\d+)\s*ms$/i);
    if (msMatch) {
      return { type: 'wait', ms: Number(msMatch[1]) };
    }
    const stateMatch = raw.match(/^(.+?)\s+(visible|hidden|attached|detached)$/i);
    if (stateMatch) {
      return {
        type: 'wait',
        selector: stateMatch[1].trim(),
        state: stateMatch[2].toLowerCase() as WaitState,
      };
    }
    return { type: 'wait', selector: raw, state: 'visible' };
  }
  if (raw.selector || raw.state || raw.ms !== undefined) {
    return {
      type: 'wait',
      selector: raw.selector !== undefined ? asString(raw.selector) : undefined,
      state: raw.state !== undefined ? WaitStateSchema.parse(raw.state) : undefined,
      ms: typeof raw.ms === 'number' ? raw.ms : undefined,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }
  // Inline form mixed into object: wait: ".x" visible: true — handled via string form mostly
  const selector = asString(raw.selector ?? '');
  return { type: 'wait', selector, state: 'visible' };
}

function normalizeAssert(raw: Record<string, unknown> | string): AssertStep {
  if (typeof raw === 'string') {
    // "current_url == /dashboard" or "$cart_total == 100" or ".error visible" or "$el visible"
    const urlMatch = raw.match(/^current_url\s+(==|contains)\s+(.+)$/i);
    if (urlMatch) {
      return {
        type: 'assert',
        kind: 'url',
        operator: urlMatch[1],
        expected: urlMatch[2].trim().replace(/^["']|["']$/g, ''),
      };
    }
    const visMatch = raw.match(/^(.+?)\s+(visible|hidden)$/i);
    if (
      visMatch &&
      !/(==|!=|>=|<=|>|<|\bcontains\b|\bmatches\b)/i.test(visMatch[1])
    ) {
      return {
        type: 'assert',
        kind: visMatch[2].toLowerCase() as 'visible' | 'hidden',
        locator: visMatch[1].trim(),
      };
    }
    return { type: 'assert', kind: 'expr', expression: raw };
  }

  // Object forms
  if (raw.text !== undefined || raw.is !== undefined) {
    const expected = asString(raw.text !== undefined ? raw.text : raw.is);
    const locatorKey = Object.keys(raw).find(
      (k) =>
        k !== 'text' &&
        k !== 'is' &&
        k !== 'timeout' &&
        k !== 'engine' &&
        k !== 'save' &&
        k !== 'debug' &&
        k !== 'soft',
    );
    const locator = asString(
      raw.locator ??
        ((locatorKey && !['attr', 'visible', 'hidden', 'contains'].includes(locatorKey)
          ? raw[locatorKey]
          : '') ||
          ''),
    );
    return {
      type: 'assert',
      kind: 'text',
      locator: locator || asString(raw.locator),
      expected,
    };
  }

  if (raw.contains !== undefined) {
    return {
      type: 'assert',
      kind: 'contains',
      locator: asString(raw.locator ?? raw.selector ?? ''),
      expected: asString(raw.contains),
    };
  }

  if (raw.visible === true || raw.visible === '' || raw.visible === null) {
    return {
      type: 'assert',
      kind: 'visible',
      locator: asString(raw.locator ?? raw.selector ?? ''),
    };
  }
  if (raw.hidden === true || raw.hidden === '' || raw.hidden === null) {
    return {
      type: 'assert',
      kind: 'hidden',
      locator: asString(raw.locator ?? raw.selector ?? ''),
    };
  }
  if (raw.attr !== undefined) {
    // attr: value == $user  OR attr: class contains "active"
    const attrRaw = asString(raw.attr);
    const m = attrRaw.match(/^(\S+)\s+(==|!=|contains|matches)\s+(.+)$/);
    if (m) {
      return {
        type: 'assert',
        kind: 'attr',
        locator: asString(raw.locator ?? ''),
        attr: m[1],
        operator: m[2],
        expected: m[3].trim().replace(/^["']|["']$/g, ''),
      };
    }
    return {
      type: 'assert',
      kind: 'attr',
      locator: asString(raw.locator ?? ''),
      attr: attrRaw,
      operator: '==',
      expected: asString(raw.expected ?? ''),
    };
  }

  // Expression assert stored as object with single expression field
  if (raw.expression) {
    return { type: 'assert', kind: 'expr', expression: asString(raw.expression) };
  }

  // Fallback: stringify as expression
  return { type: 'assert', kind: 'expr', expression: JSON.stringify(raw) };
}

function isSoftFlag(raw: Record<string, unknown>): boolean {
  return raw.soft === true || raw.soft === 'true' || raw.soft === '';
}

/** Parse assert / soft_assert step forms from a YAML mapping. */
function normalizeAssertFromRaw(
  raw: Record<string, unknown>,
  primaryKey: 'assert' | 'soft_assert',
): AssertStep {
  let step: AssertStep;
  if (typeof raw[primaryKey] === 'string') {
    const value = raw[primaryKey] as string;
    if (raw.text !== undefined || raw.is !== undefined) {
      step = {
        type: 'assert',
        kind: 'text',
        locator: value,
        expected: asString(raw.text !== undefined ? raw.text : raw.is),
      };
    } else if (raw.contains !== undefined) {
      step = {
        type: 'assert',
        kind: 'contains',
        locator: value,
        expected: asString(raw.contains),
      };
    } else if ('visible' in raw) {
      step = { type: 'assert', kind: 'visible', locator: value };
    } else if ('hidden' in raw) {
      step = { type: 'assert', kind: 'hidden', locator: value };
    } else if (raw.attr !== undefined) {
      const attrRaw = asString(raw.attr);
      const m = attrRaw.match(/^(\S+)\s+(==|!=|contains|matches)\s+(.+)$/);
      if (m) {
        step = {
          type: 'assert',
          kind: 'attr',
          locator: value,
          attr: m[1],
          operator: m[2],
          expected: m[3].trim().replace(/^["']|["']$/g, ''),
        };
      } else {
        step = normalizeAssert(value);
      }
    } else {
      step = normalizeAssert(value);
    }
  } else if (isPlainObject(raw[primaryKey])) {
    step = normalizeAssert(raw[primaryKey] as Record<string, unknown>);
  } else {
    throw new Error(`Invalid ${primaryKey} step`);
  }

  if (primaryKey === 'soft_assert' || isSoftFlag(raw)) {
    step.soft = true;
  }
  return step;
}

/**
 * YAML may parse shorthand steps as:
 * - { click: "#btn" }
 * - { fill: "#email", with: "$user" }
 * - { wait: ".dashboard visible" }
 * - { assert: ".welcome", text: "Hi" }
 * - { soft_assert: ".price", text: "$10" }
 * - { if: "$x == 1", then: [...], else: [...] }
 */
export function normalizeStep(raw: unknown): Step {
  if (typeof raw === 'string') {
    throw new Error(`Invalid step (string): ${raw}`);
  }
  if (!isPlainObject(raw)) {
    throw new Error(`Invalid step: ${JSON.stringify(raw)}`);
  }

  // Flow constructs first
  if (
    'with' in raw &&
    typeof raw.with === 'string' &&
    Array.isArray(raw.steps) &&
    !('fill' in raw) &&
    !('select' in raw)
  ) {
    const engine = raw.with.trim();
    if (!engine) {
      throw new Error('with: engine id must be a non-empty string');
    }
    return {
      type: 'with',
      engine,
      steps: raw.steps.map(normalizeStep),
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('if' in raw) {
    const thenSteps = Array.isArray(raw.then) ? raw.then.map(normalizeStep) : [];
    const elseSteps = Array.isArray(raw.else) ? raw.else.map(normalizeStep) : undefined;
    return {
      type: 'if',
      condition: asString(raw.if),
      then: thenSteps,
      else: elseSteps,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
      engine: raw.engine !== undefined ? asString(raw.engine) : undefined,
    };
  }

  if ('for' in raw) {
    const forExpr = asString(raw.for);
    // "$item in [...]" or "$i in range(1,5)" or "$product in $products_list"
    const m = forExpr.match(/^\$?(\w+)\s+in\s+(.+)$/i);
    if (!m) {
      throw new Error(`Invalid for expression: ${forExpr}`);
    }
    const steps = Array.isArray(raw.steps) ? raw.steps.map(normalizeStep) : [];
    return {
      type: 'for',
      variable: m[1],
      iterable: m[2].trim(),
      steps,
    };
  }

  if ('repeat' in raw) {
    const steps = Array.isArray(raw.steps) ? raw.steps.map(normalizeStep) : [];
    if (typeof raw.repeat === 'number') {
      return { type: 'repeat', times: raw.repeat, steps };
    }
    if (typeof raw.repeat === 'string') {
      const timesMatch = raw.repeat.match(/^(\d+)\s*times?$/i);
      if (timesMatch) {
        return { type: 'repeat', times: Number(timesMatch[1]), steps };
      }
    }
    if (isPlainObject(raw.repeat) && raw.repeat.until !== undefined) {
      return { type: 'repeat', until: asString(raw.repeat.until), steps };
    }
    if (raw.until !== undefined) {
      return { type: 'repeat', until: asString(raw.until), steps };
    }
    if (raw.times !== undefined) {
      return { type: 'repeat', times: Number(raw.times), steps };
    }
    throw new Error(`Invalid repeat: ${JSON.stringify(raw.repeat)}`);
  }

  if ('parallel' in raw) {
    let steps: Step[] = [];
    let wait: 'all' | 'any' | undefined;
    if (Array.isArray(raw.parallel)) {
      steps = raw.parallel.map(normalizeStep);
    } else if (isPlainObject(raw.parallel)) {
      wait = raw.parallel.wait === 'any' ? 'any' : 'all';
      const inner = Array.isArray(raw.parallel.steps) ? raw.parallel.steps : [];
      steps = inner.map(normalizeStep);
    }
    return { type: 'parallel', wait, steps };
  }

  if ('do' in raw) {
    const target = asString(raw.do).trim();
    if (!target) {
      throw new Error('do: target is empty (expected page.action or action)');
    }
    const vars: Record<string, unknown> = {};
    if (isPlainObject(raw.vars)) {
      Object.assign(vars, raw.vars);
    }
    const reserved = new Set(['do', 'timeout', 'engine', 'save', 'debug', 'vars']);
    for (const [k, v] of Object.entries(raw)) {
      if (!reserved.has(k)) vars[k] = v;
    }
    return {
      type: 'do',
      target,
      vars: Object.keys(vars).length ? vars : undefined,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
      engine: raw.engine !== undefined ? asString(raw.engine) : undefined,
      save: raw.save !== undefined ? asString(raw.save) : undefined,
      debug: typeof raw.debug === 'boolean' ? raw.debug : undefined,
    };
  }

  if ('include' in raw) {
    if (typeof raw.include === 'string') {
      // "common/logout.yaml" or "login/login" (page action)
      const val = raw.include;
      if (val.endsWith('.yaml') || val.endsWith('.yml') || val.includes('/')) {
        const parts = val.split('/');
        // pages style: login/login → file login, action login — resolved later
        if (!val.endsWith('.yaml') && !val.endsWith('.yml') && parts.length === 2) {
          return {
            type: 'include',
            file: parts[0],
            action: parts[1],
            vars: isPlainObject(raw.vars) ? (raw.vars as Record<string, unknown>) : undefined,
          };
        }
        return {
          type: 'include',
          file: val,
          vars: isPlainObject(raw.vars) ? (raw.vars as Record<string, unknown>) : undefined,
        };
      }
      return { type: 'include', action: val };
    }
    if (isPlainObject(raw.include)) {
      return {
        type: 'include',
        file: raw.include.file !== undefined ? asString(raw.include.file) : undefined,
        action: raw.include.action !== undefined ? asString(raw.include.action) : undefined,
        vars: isPlainObject(raw.include.vars)
          ? (raw.include.vars as Record<string, unknown>)
          : isPlainObject(raw.vars)
            ? (raw.vars as Record<string, unknown>)
            : undefined,
      };
    }
  }

  // Action steps by primary command key
  if ('goto' in raw) {
    if (typeof raw.goto === 'string') {
      return {
        type: 'goto',
        url: raw.goto,
        timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
        engine: raw.engine !== undefined ? asString(raw.engine) : undefined,
        save: raw.save !== undefined ? asString(raw.save) : undefined,
      };
    }
    if (isPlainObject(raw.goto)) {
      return {
        type: 'goto',
        url: asString(raw.goto.url),
        timeout: typeof raw.goto.timeout === 'number' ? raw.goto.timeout : typeof raw.timeout === 'number' ? raw.timeout : undefined,
        engine: raw.engine !== undefined ? asString(raw.engine) : undefined,
      };
    }
  }

  if ('click' in raw || 'tap' in raw) {
    const key = 'click' in raw ? 'click' : 'tap';
    const value = raw[key];
    if (typeof value === 'string') {
      return {
        type: 'click',
        locator: value,
        timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
        engine: raw.engine !== undefined ? asString(raw.engine) : undefined,
        save: raw.save !== undefined ? asString(raw.save) : undefined,
      };
    }
    if (isPlainObject(value)) {
      return {
        type: 'click',
        locator: asString(value.locator ?? value.selector),
        timeout:
          typeof value.timeout === 'number'
            ? value.timeout
            : typeof raw.timeout === 'number'
              ? raw.timeout
              : undefined,
        save: raw.save !== undefined ? asString(raw.save) : undefined,
      };
    }
  }

  if ('fill' in raw) {
    const locator = typeof raw.fill === 'string' ? raw.fill : asString(isPlainObject(raw.fill) ? raw.fill.locator : '');
    const withVal = raw.with !== undefined
      ? asString(raw.with)
      : isPlainObject(raw.fill) && raw.fill.with !== undefined
        ? asString(raw.fill.with)
        : '';
    return {
      type: 'fill',
      locator,
      with: withVal,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
      save: raw.save !== undefined ? asString(raw.save) : undefined,
    };
  }

  if ('select' in raw) {
    return {
      type: 'select',
      locator: typeof raw.select === 'string' ? raw.select : asString(isPlainObject(raw.select) ? raw.select.locator : ''),
      with: asString(raw.with),
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('check' in raw) {
    return {
      type: 'check',
      locator: typeof raw.check === 'string' ? raw.check : asString(isPlainObject(raw.check) ? raw.check.locator : ''),
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('uncheck' in raw) {
    return {
      type: 'uncheck',
      locator: typeof raw.uncheck === 'string' ? raw.uncheck : asString(isPlainObject(raw.uncheck) ? raw.uncheck.locator : ''),
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('scroll' in raw) {
    let locator = '';
    let intoView: boolean | undefined;
    let deltaX: number | undefined;
    let deltaY: number | undefined;
    if (typeof raw.scroll === 'string') {
      const intoMatch = raw.scroll.match(/^(.+?)\s+into_view\s*$/i);
      if (intoMatch) {
        locator = intoMatch[1].trim();
        intoView = true;
      } else {
        locator = raw.scroll;
      }
    } else if (isPlainObject(raw.scroll)) {
      locator = asString(raw.scroll.locator ?? raw.scroll.selector);
      if (typeof raw.scroll.into_view === 'boolean') intoView = raw.scroll.into_view;
      if (typeof raw.scroll.delta_x === 'number') deltaX = raw.scroll.delta_x;
      if (typeof raw.scroll.delta_y === 'number') deltaY = raw.scroll.delta_y;
    }
    if (typeof raw.into_view === 'boolean') intoView = raw.into_view;
    if (typeof raw.delta_x === 'number') deltaX = raw.delta_x;
    if (typeof raw.delta_y === 'number') deltaY = raw.delta_y;
    return {
      type: 'scroll',
      locator,
      intoView,
      deltaX,
      deltaY,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('swipe' in raw) {
    let locator = '';
    let direction: SwipeDirection | undefined;
    let distance: number | undefined;
    if (typeof raw.swipe === 'string') {
      locator = raw.swipe;
    } else if (isPlainObject(raw.swipe)) {
      locator = asString(raw.swipe.locator ?? raw.swipe.selector);
      if (typeof raw.swipe.direction === 'string') {
        direction = raw.swipe.direction.toLowerCase() as SwipeDirection;
      }
      if (typeof raw.swipe.distance === 'number') distance = raw.swipe.distance;
    }
    if (typeof raw.direction === 'string') {
      direction = raw.direction.toLowerCase() as SwipeDirection;
    }
    if (typeof raw.distance === 'number') distance = raw.distance;
    const dirs = new Set(['left', 'right', 'up', 'down']);
    if (!direction || !dirs.has(direction)) {
      throw new Error(
        'swipe: "direction" is required (left | right | up | down)',
      );
    }
    return {
      type: 'swipe',
      locator,
      direction,
      distance,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('long_press' in raw) {
    let locator = '';
    let durationMs: number | undefined;
    if (typeof raw.long_press === 'string') {
      locator = raw.long_press;
    } else if (isPlainObject(raw.long_press)) {
      locator = asString(raw.long_press.locator ?? raw.long_press.selector);
      if (typeof raw.long_press.duration_ms === 'number') {
        durationMs = raw.long_press.duration_ms;
      }
    }
    if (typeof raw.duration_ms === 'number') durationMs = raw.duration_ms;
    return {
      type: 'long_press',
      locator,
      durationMs,
      timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
    };
  }

  if ('wait' in raw) {
    if (typeof raw.wait === 'string' || typeof raw.wait === 'number') {
      return normalizeWait(raw.wait);
    }
    if (isPlainObject(raw.wait)) {
      return normalizeWait(raw.wait as Record<string, unknown>);
    }
  }

  if ('screenshot' in raw) {
    if (typeof raw.screenshot === 'string') {
      return {
        type: 'screenshot',
        file: raw.screenshot,
        fullPage: Boolean(raw.full_page),
      };
    }
    if (isPlainObject(raw.screenshot)) {
      return {
        type: 'screenshot',
        file: asString(raw.screenshot.file),
        fullPage: Boolean(raw.screenshot.full_page ?? raw.full_page),
      };
    }
  }

  if ('soft_assert' in raw) {
    return normalizeAssertFromRaw(raw, 'soft_assert');
  }

  if ('assert' in raw) {
    // Forms:
    // assert: ".welcome" text: "Hi"  → { assert: ".welcome", text: "Hi" }
    // soft_assert: ".price" text: "$10"
    // assert: ".error" visible       → { assert: ".error visible" } or { assert: ".error", visible: null }
    // assert: current_url == "/x"    → { assert: "current_url == /x" }
    // assert: $x == 1                → { assert: "$x == 1" }
    // assert: ".x" soft: true
    return normalizeAssertFromRaw(raw, 'assert');
  }

  if ('api' in raw) {
    if (typeof raw.api === 'string') {
      // api: /me save: user_data
      return {
        type: 'api',
        method: asString(raw.method ?? 'GET'),
        url: raw.api,
        save: raw.save !== undefined ? asString(raw.save).replace(/^\$/, '') : undefined,
        headers: isPlainObject(raw.headers) ? (raw.headers as Record<string, string>) : undefined,
        body: raw.body,
        timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
      };
    }
    if (isPlainObject(raw.api)) {
      return {
        type: 'api',
        method: asString(raw.api.method ?? 'GET').toUpperCase(),
        url: asString(raw.api.url),
        headers: isPlainObject(raw.api.headers)
          ? (raw.api.headers as Record<string, string>)
          : undefined,
        body: raw.api.body,
        save: raw.save !== undefined
          ? asString(raw.save).replace(/^\$/, '')
          : raw.api.save !== undefined
            ? asString(raw.api.save).replace(/^\$/, '')
            : undefined,
        timeout: typeof raw.api.timeout === 'number' ? raw.api.timeout : typeof raw.timeout === 'number' ? raw.timeout : undefined,
      };
    }
  }

  // HTTP engine verbs (preferred over api: for new scenarios)
  for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    if (method in raw) {
      const value = raw[method];
      let url = '';
      let headers: Record<string, string> | undefined;
      let body: unknown;
      let timeout: number | undefined;
      if (typeof value === 'string') {
        url = value;
      } else if (isPlainObject(value)) {
        url = asString(value.url ?? value.path ?? '');
        headers = isPlainObject(value.headers)
          ? (value.headers as Record<string, string>)
          : undefined;
        body = value.body;
        if (typeof value.timeout === 'number') timeout = value.timeout;
      }
      if (isPlainObject(raw.headers)) {
        headers = raw.headers as Record<string, string>;
      }
      if (raw.body !== undefined) body = raw.body;
      if (typeof raw.timeout === 'number') timeout = raw.timeout;
      return {
        type: 'api',
        method: method.toUpperCase(),
        url,
        headers,
        body,
        save: raw.save !== undefined ? asString(raw.save).replace(/^\$/, '') : undefined,
        timeout,
      };
    }
  }

  if ('set' in raw) {
    return { type: 'set', expression: asString(raw.set) };
  }

  if ('get_text' in raw) {
    return {
      type: 'get_text',
      locator: typeof raw.get_text === 'string' ? raw.get_text : asString(isPlainObject(raw.get_text) ? raw.get_text.locator : ''),
      save: raw.save !== undefined ? asString(raw.save).replace(/^\$/, '') : undefined,
    };
  }

  if ('get_attr' in raw) {
    return {
      type: 'get_attr',
      locator: typeof raw.get_attr === 'string' ? raw.get_attr : asString(isPlainObject(raw.get_attr) ? raw.get_attr.locator : ''),
      attr: asString(raw.attr),
      save: raw.save !== undefined ? asString(raw.save).replace(/^\$/, '') : undefined,
    };
  }

  if ('log' in raw) {
    if (typeof raw.log === 'string') {
      return { type: 'log', message: raw.log, level: 'info' };
    }
    if (isPlainObject(raw.log)) {
      return {
        type: 'log',
        message: asString(raw.log.message),
        level: (asString(raw.log.level || 'info') as 'info' | 'debug' | 'warn' | 'error'),
      };
    }
  }

  if ('debug' in raw) {
    return { type: 'debug', enabled: Boolean(raw.debug) };
  }

  const pk = getPrimaryKey(raw);
  throw new Error(`Unknown step: ${pk ?? JSON.stringify(raw)}`);
}

const RootSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  engine: z.string().optional(),
  timeout: z.number().optional(),
  retries: z.number().int().min(0).optional(),
  vars: z.record(z.unknown()).optional(),
  secrets: z
    .object({
      env: z
        .object({
          file: z.string().optional(),
          encoding: z.string().optional(),
        })
        .optional(),
    })
    .strict()
    .optional(),
  imports: z.array(z.string()).optional(),
  data: z.array(z.unknown()).optional(),
  cases: z.array(z.record(z.unknown())).optional(),
  before_each: z.array(z.unknown()).optional(),
  after_each: z.array(z.unknown()).optional(),
  steps: z.array(z.unknown()).optional(),
  locator_strategy: z.string().min(1).optional(),
  elements: z
    .record(
      z.union([
        z.string(),
        z.object({
          strategy: z.string().optional(),
          value: z.string(),
        }),
      ]),
    )
    .optional(),
  actions: z.record(z.array(z.unknown())).optional(),
  // Page objects may omit steps
}).passthrough();

export function parseNatlDocument(raw: unknown, sourcePath?: string): NatFileMeta {
  const parsed = RootSchema.parse(raw ?? {});
  const steps = Array.isArray(parsed.steps) ? parsed.steps.map(normalizeStep) : [];
  const before_each = Array.isArray(parsed.before_each)
    ? parsed.before_each.map(normalizeStep)
    : undefined;
  const after_each = Array.isArray(parsed.after_each)
    ? parsed.after_each.map(normalizeStep)
    : undefined;

  let actions: Record<string, Step[]> | undefined;
  if (parsed.actions) {
    actions = {};
    for (const [name, actionSteps] of Object.entries(parsed.actions)) {
      actions[name] = actionSteps.map(normalizeStep);
    }
  }

  // Fix set expression — re-normalize was buggy with duplicate; ensure sets keep $
  const fixSet = (s: Step): Step => {
    if (s.type === 'if') {
      return { ...s, then: s.then.map(fixSet), else: s.else?.map(fixSet) };
    }
    if (s.type === 'for' || s.type === 'repeat' || s.type === 'parallel' || s.type === 'with') {
      return { ...s, steps: s.steps.map(fixSet) };
    }
    return s;
  };

  return {
    name: parsed.name,
    tags: parsed.tags,
    engine: parsed.engine,
    timeout: parsed.timeout,
    retries: parsed.retries,
    vars: parsed.vars,
    secrets: parsed.secrets,
    imports: parsed.imports,
    data: parsed.data,
    cases: parsed.cases,
    before_each: before_each?.map(fixSet),
    after_each: after_each?.map(fixSet),
    steps: steps.map(fixSet),
    locator_strategy: parsed.locator_strategy,
    elements: parsed.elements,
    actions: actions
      ? Object.fromEntries(
          Object.entries(actions).map(([k, v]) => [k, v.map(fixSet)]),
        )
      : undefined,
    sourcePath,
  };
}

function originalLineOf(
  node: { range?: [number, number, number] | null } | null | undefined,
  lineCounter: LineCounter,
  toOriginalLine: number[],
): number | undefined {
  if (!node?.range) return undefined;
  const { line } = lineCounter.linePos(node.range[0]);
  return toOriginalLine[line - 1] ?? line;
}

function enrichStepLines(
  seqNode: unknown,
  steps: Step[],
  lineCounter: LineCounter,
  toOriginalLine: number[],
): void {
  if (!isSeq(seqNode)) return;
  const seq = seqNode as YAMLSeq;
  for (let i = 0; i < steps.length; i++) {
    const item = seq.items[i] as { range?: [number, number, number] | null } | undefined;
    const line = originalLineOf(item, lineCounter, toOriginalLine);
    if (line !== undefined) {
      steps[i].line = line;
    }
    const step = steps[i];
    if (!isMap(item)) continue;
    const map = item as YAMLMap;
    if (step.type === 'if') {
      enrichStepLines(map.get('then', true), step.then, lineCounter, toOriginalLine);
      if (step.else) {
        enrichStepLines(map.get('else', true), step.else, lineCounter, toOriginalLine);
      }
    } else if (step.type === 'for' || step.type === 'repeat') {
      enrichStepLines(map.get('steps', true), step.steps, lineCounter, toOriginalLine);
    } else if (step.type === 'parallel') {
      const parallelNode = map.get('parallel', true);
      if (isSeq(parallelNode)) {
        enrichStepLines(parallelNode, step.steps, lineCounter, toOriginalLine);
      } else if (isMap(parallelNode)) {
        enrichStepLines(
          (parallelNode as YAMLMap).get('steps', true),
          step.steps,
          lineCounter,
          toOriginalLine,
        );
      }
    }
  }
}

export function parseNatlFile(filePath: string): NatFileMeta {
  const abs = isAbsolute(filePath) ? filePath : resolve(filePath);
  if (!existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  const content = readFileSync(abs, 'utf-8');
  const { text: preprocessed, toOriginalLine } = preprocessNatlSourceWithMap(content);
  const lineCounter = new LineCounter();
  const yamlDoc = parseDocument(preprocessed, { lineCounter });
  const meta = parseNatlDocument(yamlDoc.toJS(), abs);

  enrichStepLines(yamlDoc.get('steps', true), meta.steps, lineCounter, toOriginalLine);
  if (meta.before_each) {
    enrichStepLines(yamlDoc.get('before_each', true), meta.before_each, lineCounter, toOriginalLine);
  }
  if (meta.after_each) {
    enrichStepLines(yamlDoc.get('after_each', true), meta.after_each, lineCounter, toOriginalLine);
  }
  if (meta.actions) {
    const actionsNode = yamlDoc.get('actions', true);
    if (isMap(actionsNode)) {
      for (const [name, actionSteps] of Object.entries(meta.actions)) {
        enrichStepLines(
          (actionsNode as YAMLMap).get(name, true),
          actionSteps,
          lineCounter,
          toOriginalLine,
        );
      }
    }
  }

  return meta;
}

export function resolveImportPath(fromFile: string, importPath: string): string {
  const base = dirname(fromFile);
  const candidates = [
    resolve(base, importPath),
    resolve(base, `${importPath}.yaml`),
    resolve(base, `${importPath}.yml`),
    resolve(base, 'pages', `${importPath}.yaml`),
    resolve(base, 'pages', `${importPath}.yml`),
    resolve(base, '..', 'pages', `${importPath}.yaml`),
    resolve(base, '..', 'pages', `${importPath}.yml`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return resolve(base, importPath.endsWith('.yaml') || importPath.endsWith('.yml') ? importPath : `${importPath}.yaml`);
}
