/**
 * NATL allows YAML-like compact step forms that are not valid YAML, e.g.:
 *   - fill: "#email" with: $user
 *   - assert: ".welcome" text: "Hello"
 *   - wait: ".dashboard" visible
 *   - get_text: ".title" save: page_title
 *
 * This preprocessor rewrites them into valid multi-line YAML mappings.
 */

const STEP_COMMANDS = new Set([
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
  'include',
  'do',
]);

const SECONDARY_KEYS = new Set([
  'with',
  'text',
  'is',
  'contains',
  'save',
  'attr',
  'timeout',
  'engine',
  'method',
  'full_page',
  'level',
  'state',
  'selector',
  'locator',
  'file',
  'times',
  'until',
  'vars',
  'url',
  'message',
  'visible',
  'hidden',
  'soft',
  'into_view',
  'direction',
  'distance',
  'duration_ms',
  'delta_x',
  'delta_y',
]);

const FLAG_KEYS = new Set(['visible', 'hidden', 'soft', 'into_view']);

function findSecondaryKey(rest: string, from: number): number {
  // Find ` key:` or ` key` (flag) at word boundary, not inside quotes
  let i = from;
  let inSingle = false;
  let inDouble = false;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble && /\s/.test(ch)) {
      // Look ahead for key
      const slice = rest.slice(i + 1);
      const m = slice.match(/^([a-zA-Z_][\w]*)\s*(:|$|\s)/);
      if (m && SECONDARY_KEYS.has(m[1])) {
        // For flags like `visible` at end or before another key
        if (m[2] === ':' || FLAG_KEYS.has(m[1])) {
          return i + 1;
        }
      }
    }
    i++;
  }
  return -1;
}

function parseSecondaryPairs(tail: string): Array<{ key: string; value?: string }> {
  const pairs: Array<{ key: string; value?: string }> = [];
  let remaining = tail.trim();
  while (remaining) {
    const m = remaining.match(/^([a-zA-Z_][\w]*)\s*(?::\s*)?/);
    if (!m || !SECONDARY_KEYS.has(m[1])) break;
    const key = m[1];
    remaining = remaining.slice(m[0].length).trimStart();

    if (FLAG_KEYS.has(key) && (remaining === '' || /^[a-zA-Z_][\w]*\s*(:|$)/.test(remaining) && SECONDARY_KEYS.has(remaining.match(/^([a-zA-Z_][\w]*)/)![1]) && !remaining.startsWith(key))) {
      // Flag without value — but careful: `visible: true` has colon already consumed
      // If colon was in m[0] via `:?`, check if we had a colon
      const hadColon = m[0].includes(':');
      if (!hadColon) {
        pairs.push({ key, value: 'true' });
        continue;
      }
    }

    // Value until next secondary key
    const next = findSecondaryKey(' ' + remaining, 0);
    // findSecondaryKey expects leading content; search in remaining
    let end = remaining.length;
    let i = 0;
    let inSingle = false;
    let inDouble = false;
    while (i < remaining.length) {
      const ch = remaining[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble && /\s/.test(ch)) {
        const slice = remaining.slice(i + 1);
        const km = slice.match(/^([a-zA-Z_][\w]*)(\s*:|(?=\s|$))/);
        if (km && SECONDARY_KEYS.has(km[1])) {
          const isFlag = FLAG_KEYS.has(km[1]) && !slice.slice(km[1].length).trimStart().startsWith(':');
          const isKeyed = slice.slice(km[1].length).trimStart().startsWith(':') || km[2].includes(':');
          if (isFlag || isKeyed) {
            end = i;
            break;
          }
        }
      }
      i++;
    }
    void next;
    let value = remaining.slice(0, end).trim();
    remaining = remaining.slice(end).trim();

    if (FLAG_KEYS.has(key) && value === '') {
      pairs.push({ key, value: 'true' });
    } else {
      pairs.push({ key, value });
    }
  }
  return pairs;
}

function rewriteCompactLine(line: string): string[] | null {
  // Match list item with command
  const m = line.match(/^(\s*)-\s*([a-zA-Z_][\w]*)\s*:\s*(.*)$/);
  if (!m) return null;
  const indent = m[1];
  const cmd = m[2];
  const rest = m[3];
  if (!STEP_COMMANDS.has(cmd)) return null;
  if (!rest.trim()) return null;

  // Flow constructs with then/else on same line are rare; skip if/for/repeat object forms
  if (cmd === 'if' || cmd === 'for' || cmd === 'repeat' || cmd === 'parallel') {
    return null;
  }

  const keyPos = findSecondaryKey(rest, 0);
  // Also detect trailing flags without leading search from 0 when primary has no spaces... 
  // findSecondaryKey starts looking after whitespace, so for `"#email" with:` it finds `with`

  // Special: `wait: 2000 ms` — treat as single value
  if (cmd === 'wait' && /^\d+\s*ms$/i.test(rest.trim())) {
    return null;
  }

  // Detect trailing visible/hidden after a selector-like primary
  const flagMatch = rest.match(/^(.*)\s+(visible|hidden)\s*$/i);
  if (flagMatch && (cmd === 'wait' || cmd === 'assert' || cmd === 'soft_assert')) {
    const primary = flagMatch[1].trim();
    const flag = flagMatch[2].toLowerCase();
    // Ensure primary doesn't already look like an expression with operators for assert
    if (
      (cmd === 'assert' || cmd === 'soft_assert') &&
      /(=|contains|matches)/.test(primary) &&
      !primary.startsWith('.') &&
      !primary.startsWith('#') &&
      !primary.startsWith('[')
    ) {
      // e.g. current_url == "x" — leave alone
      return null;
    }
    if (cmd === 'wait') {
      return [`${indent}- wait: ${JSON.stringify(`${stripQuotes(primary)} ${flag}`)}`];
    }
    return [
      `${indent}- ${cmd}: ${quoteIfNeeded(primary)}`,
      `${indent}  ${flag}: true`,
    ];
  }

  // `scroll: $footer into_view`
  const intoViewMatch = rest.match(/^(.*)\s+into_view\s*$/i);
  if (intoViewMatch && cmd === 'scroll') {
    return [
      `${indent}- scroll: ${quoteIfNeeded(intoViewMatch[1].trim())}`,
      `${indent}  into_view: true`,
    ];
  }

  if (keyPos < 0) {
    return null; // single value, valid YAML
  }

  const primary = rest.slice(0, keyPos).trim();
  const tail = rest.slice(keyPos).trim();
  const pairs = parseSecondaryPairs(tail);
  if (!pairs.length) return null;

  const lines: string[] = [`${indent}- ${cmd}: ${quoteIfNeeded(primary)}`];
  for (const p of pairs) {
    if (p.value === undefined || p.value === '') {
      lines.push(`${indent}  ${p.key}: true`);
    } else {
      lines.push(`${indent}  ${p.key}: ${quoteIfNeeded(p.value)}`);
    }
  }
  return lines;
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function quoteIfNeeded(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'")) ||
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  ) {
    return t;
  }
  // Numbers, booleans, null, plain scalars without special chars
  if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(t)) return t;
  // Variables and simple selectors
  if (/^[$#.\[\]\w./:@%+-]+$/.test(t)) return t;
  // Contains spaces or special — quote
  if (/[:#{}[\],&*?|>!%@`]/.test(t) || /\s/.test(t)) {
    return JSON.stringify(t);
  }
  return t;
}

export interface PreprocessResult {
  text: string;
  /** 0-based preprocessed line index → 1-based original source line */
  toOriginalLine: number[];
}

export function preprocessNatlSourceWithMap(source: string): PreprocessResult {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  const toOriginalLine: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const originalLine = i + 1;
    // Skip comments and empty
    if (/^\s*#/.test(line) || !line.trim()) {
      out.push(line);
      toOriginalLine.push(originalLine);
      continue;
    }
    const rewritten = rewriteCompactLine(line);
    if (rewritten) {
      for (const r of rewritten) {
        out.push(r);
        toOriginalLine.push(originalLine);
      }
    } else {
      out.push(line);
      toOriginalLine.push(originalLine);
    }
  }
  return { text: out.join('\n'), toOriginalLine };
}

export function preprocessNatlSource(source: string): string {
  return preprocessNatlSourceWithMap(source).text;
}
