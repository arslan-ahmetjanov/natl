import { relative } from 'node:path';
import type { Step } from './types.js';

/** Display path relative to cwd when possible (forward slashes). */
export function formatSourcePath(sourcePath: string | undefined, cwd = process.cwd()): string {
  if (!sourcePath) return '<unknown>';
  const rel = relative(cwd, sourcePath);
  const useRel = rel && !rel.startsWith('..') && !rel.startsWith('/');
  const p = useRel ? rel : sourcePath;
  return p.replace(/\\/g, '/');
}

/** Short step description for FAIL lines, e.g. `click "#login-btn"`. */
export function formatStepShort(step: Step, interpolate?: (s: string) => string): string {
  const i = interpolate ?? ((s: string) => s);
  switch (step.type) {
    case 'goto':
      return `goto "${i(step.url)}"`;
    case 'click':
      return `click "${i(step.locator)}"`;
    case 'fill':
      return `fill "${i(step.locator)}"`;
    case 'select':
      return `select "${i(step.locator)}"`;
    case 'check':
      return `check "${i(step.locator)}"`;
    case 'uncheck':
      return `uncheck "${i(step.locator)}"`;
    case 'scroll':
      return `scroll "${i(step.locator)}"`;
    case 'swipe':
      return `swipe "${i(step.locator)}" ${step.direction}`;
    case 'long_press':
      return `long_press "${i(step.locator)}"`;
    case 'wait':
      if (step.ms !== undefined) return `wait ${step.ms}ms`;
      if (step.selector) return `wait "${i(step.selector)}"`;
      return 'wait';
    case 'screenshot':
      return `screenshot "${i(step.file)}"`;
    case 'assert': {
      const loc = step.locator ? ` "${i(step.locator)}"` : '';
      const prefix = step.soft ? 'soft_assert' : 'assert';
      return `${prefix} ${step.kind}${loc}`;
    }
    case 'api':
      return `api ${step.method} "${i(step.url)}"`;
    case 'with':
      return `with ${step.engine}`;
    case 'set':
      return `set ${step.expression}`;
    case 'get_text':
      return `get_text "${i(step.locator)}"`;
    case 'get_attr':
      return `get_attr "${i(step.locator)}"`;
    case 'log':
      return `log`;
    case 'debug':
      return `debug`;
    case 'if':
      return `if ${step.condition}`;
    case 'for':
      return `for ${step.variable}`;
    case 'repeat':
      return step.times !== undefined ? `repeat ${step.times}` : `repeat until`;
    case 'parallel':
      return 'parallel';
    case 'include':
      return `include ${step.file ?? step.action ?? ''}`;
    case 'do':
      return `do ${step.target}`;
    default: {
      const _exhaustive: never = step;
      return String((_exhaustive as Step).type);
    }
  }
}

/** `FAIL file:line [engine] short — reason` (line/engine omitted if unknown). */
export function formatStepFail(
  sourcePath: string | undefined,
  step: Step,
  reason: string,
  interpolate?: (s: string) => string,
  opts?: { engine?: string },
): string {
  const file = formatSourcePath(sourcePath);
  const loc = step.line !== undefined ? `${file}:${step.line}` : file;
  const engineTag = opts?.engine ? ` [${opts.engine}]` : '';
  const short = formatStepShort(step, interpolate);
  const cleaned = reason.replace(/^FAIL\s+/, '');
  return `FAIL ${loc}${engineTag} ${short} — ${cleaned}`;
}
