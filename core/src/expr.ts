import { randomInt, randomBytes, randomUUID } from 'node:crypto';
import type { SecretsStore } from './secrets.js';
import { formatLocatorRef, isLocatorRef } from './locator.js';
export type VarScope = Record<string, unknown>;

function isTruthy(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0 && v !== 'false' && v !== '0';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function getPath(scope: VarScope, path: string): unknown {
  const parts = path.replace(/^\$/, '').split('.');
  let cur: unknown = scope;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPath(scope: VarScope, path: string, value: unknown): void {
  const parts = path.replace(/^\$/, '').split('.');
  let cur: Record<string, unknown> = scope;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null) {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

const builtins: Record<string, (...args: unknown[]) => unknown> = {
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().slice(0, 10),
  random_int: (min, max) => randomInt(Number(min), Number(max) + 1),
  random_string: (length) => {
    const n = Number(length) || 8;
    return randomBytes(Math.ceil(n / 2))
      .toString('hex')
      .slice(0, n);
  },
  random_uuid: () => randomUUID(),
  random_email: () => `user_${randomBytes(4).toString('hex')}@example.com`,
  len: (item) => {
    if (typeof item === 'string' || Array.isArray(item)) return item.length;
    if (item && typeof item === 'object') return Object.keys(item).length;
    return 0;
  },
  contains: (str, sub) => String(str).includes(String(sub)),
  trim: (str) => String(str).trim(),
  upper: (str) => String(str).toUpperCase(),
  lower: (str) => String(str).toLowerCase(),
  replace: (str, old, neu) => String(str).split(String(old)).join(String(neu)),
  match: (str, regex) => new RegExp(String(regex)).test(String(str)),
  join: (list, sep) => (Array.isArray(list) ? list : []).join(String(sep ?? ',')),
  map: (list, field) => {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      if (item && typeof item === 'object') {
        return (item as Record<string, unknown>)[String(field)];
      }
      return undefined;
    });
  },
  filter: (list, condition) => {
    if (!Array.isArray(list)) return [];
    // Simplified: condition like "price > 100" evaluated per item with item fields in scope
    return list.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const local: VarScope = { ...(item as VarScope) };
      try {
        return isTruthy(evaluateExpression(String(condition), local));
      } catch {
        return false;
      }
    });
  },
  range: (start, end) => {
    const a = Number(start);
    const b = Number(end);
    const out: number[] = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  },
};

export class ExpressionEngine {
  constructor(
    private scope: VarScope,
    private secrets?: SecretsStore,
  ) {}

  getScope(): VarScope {
    return this.scope;
  }

  set(name: string, value: unknown): void {
    setPath(this.scope, name, value);
  }

  get(name: string): unknown {
    return getPath(this.scope, name);
  }

  /** Interpolate $vars, $env.*, $secret.*, and ${ENV:} inside strings */
  interpolate(input: string): string {
    let s = this.secrets ? this.secrets.resolveRefs(input) : input;
    s = this.resolveEnvSecretRefs(s);
    // Replace $var.path (not inside ${...})
    s = s.replace(/\$([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)/g, (match, path) => {
      const val = getPath(this.scope, path);
      if (val === undefined) return match;
      if (isLocatorRef(val)) return formatLocatorRef(val);
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
    return s;
  }

  /** Resolve `$env.KEY` / `$secret.KEY` (throws if missing). */
  private resolveEnvSecretRefs(input: string): string {
    return input.replace(/\$env\.([a-zA-Z_][\w]*)/g, (_m, key: string) => {
      if (!this.secrets) {
        throw new Error(`$env.${key}: secrets/env not available`);
      }
      return this.secrets.getEnv(key);
    }).replace(/\$secret\.([a-zA-Z_][\w]*)/g, (_m, key: string) => {
      if (!this.secrets) {
        throw new Error(`$secret.${key}: secrets/env not available`);
      }
      return this.secrets.getEnv(key);
    });
  }

  /** Deep-interpolate strings in structures */
  interpolateDeep(value: unknown): unknown {
    if (typeof value === 'string') return this.interpolate(value);
    if (Array.isArray(value)) return value.map((v) => this.interpolateDeep(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.interpolateDeep(v);
      }
      return out;
    }
    return value;
  }

  evaluate(expr: string): unknown {
    let e = expr.trim();
    if (this.secrets) {
      e = this.secrets.resolveRefs(e);
    }
    return evaluateExpression(e, this.scope, this.secrets);
  }

  evaluateCondition(expr: string): boolean {
    return isTruthy(this.evaluate(expr));
  }

  /** Handle `set: $total = $price * $quantity` */
  executeSet(expression: string): void {
    let e = expression.trim();
    if (this.secrets) e = this.secrets.resolveRefs(e);
    const m = e.match(/^\$?([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)\s*=\s*(.+)$/);
    if (!m) {
      throw new Error(`Invalid set expression: ${expression}`);
    }
    const value = evaluateExpression(m[2].trim(), this.scope, this.secrets);
    setPath(this.scope, m[1], value);
  }
}

/** Public helper used by filter builtin */
export function evaluateExpression(
  expr: string,
  scope: VarScope,
  secrets?: SecretsStore,
): unknown {
  return new Parser(expr, scope, secrets).parseExpression();
}

class Parser {
  private i = 0;
  constructor(
    private readonly input: string,
    private readonly scope: VarScope,
    private readonly secrets?: SecretsStore,
  ) {}

  private peek(): string {
    return this.input[this.i] ?? '';
  }

  private next(): string {
    return this.input[this.i++] ?? '';
  }

  private skipWs(): void {
    while (/\s/.test(this.peek())) this.next();
  }

  parseExpression(): unknown {
    this.skipWs();
    return this.parseOr();
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    this.skipWs();
    while (this.matchWord('or')) {
      const right = this.parseAnd();
      left = isTruthy(left) || isTruthy(right);
      this.skipWs();
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseComparison();
    this.skipWs();
    while (this.matchWord('and')) {
      const right = this.parseComparison();
      left = isTruthy(left) && isTruthy(right);
      this.skipWs();
    }
    return left;
  }

  private matchWord(word: string): boolean {
    this.skipWs();
    const slice = this.input.slice(this.i, this.i + word.length);
    if (slice.toLowerCase() === word) {
      const after = this.input[this.i + word.length] ?? '';
      if (!/[a-zA-Z0-9_]/.test(after)) {
        this.i += word.length;
        return true;
      }
    }
    return false;
  }

  private parseComparison(): unknown {
    let left = this.parseAdd();
    this.skipWs();

    if (this.matchWord('contains')) {
      const right = this.parseAdd();
      return String(left).includes(String(right));
    }
    if (this.matchWord('matches')) {
      const right = this.parseAdd();
      return new RegExp(String(right)).test(String(left));
    }

    const ops = ['==', '!=', '>=', '<=', '>', '<'];
    for (const op of ops) {
      if (this.input.startsWith(op, this.i)) {
        this.i += op.length;
        const right = this.parseAdd();
        return compare(left, right, op);
      }
    }
    return left;
  }

  private parseAdd(): unknown {
    let left = this.parseMul();
    this.skipWs();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next();
      const right = this.parseMul();
      if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = String(left) + String(right);
      } else {
        left = Number(left) + (op === '+' ? Number(right) : -Number(right));
      }
      this.skipWs();
    }
    return left;
  }

  private parseMul(): unknown {
    let left = this.parseUnary();
    this.skipWs();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.next();
      const right = this.parseUnary();
      left = op === '*' ? Number(left) * Number(right) : Number(left) / Number(right);
      this.skipWs();
    }
    return left;
  }

  private parseUnary(): unknown {
    this.skipWs();
    if (this.peek() === '-') {
      this.next();
      return -Number(this.parseUnary());
    }
    if (this.matchWord('not')) {
      return !isTruthy(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    this.skipWs();
    const ch = this.peek();

    // String
    if (ch === '"' || ch === "'") {
      return this.parseString();
    }

    // Array literal
    if (ch === '[') {
      return this.parseArray();
    }

    // Number
    if (/[0-9]/.test(ch)) {
      return this.parseNumber();
    }

    // Variable $name, $env.KEY, $secret.KEY, or $obj.field
    if (ch === '$') {
      this.next();
      const name = this.parseIdent();
      if ((name === 'env' || name === 'secret') && this.peek() === '.') {
        this.next();
        const key = this.parseIdent();
        if (!this.secrets) {
          throw new Error(`$${name}.${key}: secrets/env not available`);
        }
        return this.secrets.getEnv(key);
      }
      let path = name;
      while (this.peek() === '.') {
        this.next();
        path += '.' + this.parseIdent();
      }
      return getPath(this.scope, path);
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const name = this.parseIdent();
      // boolean / null
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (name === 'null') return null;
      // current_url is special — injected into scope by interpreter
      this.skipWs();
      if (this.peek() === '(') {
        const args = this.parseArgs();
        const fn = builtins[name];
        if (!fn) throw new Error(`Unknown function: ${name}`);
        return fn(...args);
      }
      // bare identifier — look up in scope (for filter conditions)
      const val = getPath(this.scope, name);
      if (val !== undefined) return val;
      // dotted continue
      let path = name;
      while (this.peek() === '.') {
        this.next();
        path += '.' + this.parseIdent();
      }
      return getPath(this.scope, path);
    }

    if (ch === '(') {
      this.next();
      const v = this.parseExpression();
      this.skipWs();
      if (this.peek() !== ')') throw new Error(`Expected ) at ${this.i}`);
      this.next();
      return v;
    }

    throw new Error(`Unexpected character '${ch}' in expression: ${this.input}`);
  }

  private parseIdent(): string {
    let s = '';
    while (/[a-zA-Z0-9_]/.test(this.peek())) s += this.next();
    return s;
  }

  private parseNumber(): number {
    let s = '';
    while (/[0-9.]/.test(this.peek())) s += this.next();
    return Number(s);
  }

  private parseString(): string {
    const quote = this.next();
    let s = '';
    while (this.i < this.input.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.next();
        s += this.next();
      } else {
        s += this.next();
      }
    }
    if (this.peek() !== quote) throw new Error('Unterminated string');
    this.next();
    return s;
  }

  private parseArray(): unknown[] {
    this.next(); // [
    const items: unknown[] = [];
    this.skipWs();
    if (this.peek() === ']') {
      this.next();
      return items;
    }
    while (true) {
      items.push(this.parseExpression());
      this.skipWs();
      if (this.peek() === ',') {
        this.next();
        this.skipWs();
        continue;
      }
      if (this.peek() === ']') {
        this.next();
        break;
      }
      throw new Error(`Expected , or ] in array at ${this.i}`);
    }
    return items;
  }

  private parseArgs(): unknown[] {
    this.next(); // (
    const args: unknown[] = [];
    this.skipWs();
    if (this.peek() === ')') {
      this.next();
      return args;
    }
    while (true) {
      args.push(this.parseExpression());
      this.skipWs();
      if (this.peek() === ',') {
        this.next();
        this.skipWs();
        continue;
      }
      if (this.peek() === ')') {
        this.next();
        break;
      }
      throw new Error(`Expected , or ) in args at ${this.i}`);
    }
    return args;
  }
}

function compare(left: unknown, right: unknown, op: string): boolean {
  // Numeric compare when both look like numbers
  const ln = Number(left);
  const rn = Number(right);
  const bothNum =
    left !== '' &&
    right !== '' &&
    !Number.isNaN(ln) &&
    !Number.isNaN(rn) &&
    (typeof left === 'number' || typeof right === 'number' || /^-?\d+(\.\d+)?$/.test(String(left))) &&
    (typeof left === 'number' || typeof right === 'number' || /^-?\d+(\.\d+)?$/.test(String(right)));

  switch (op) {
    case '==':
      return bothNum ? ln === rn : String(left) === String(right);
    case '!=':
      return bothNum ? ln !== rn : String(left) !== String(right);
    case '>':
      return bothNum ? ln > rn : String(left) > String(right);
    case '<':
      return bothNum ? ln < rn : String(left) < String(right);
    case '>=':
      return bothNum ? ln >= rn : String(left) >= String(right);
    case '<=':
      return bothNum ? ln <= rn : String(left) <= String(right);
    default:
      return false;
  }
}

export { getPath, setPath, isTruthy };
