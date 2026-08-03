import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ReporterTestResult {
  name: string;
  path: string;
  ok: boolean;
  durationMs: number;
  error?: string;
  /** 1-based index of the attempt that produced this result */
  attempt?: number;
  /** How many attempts were actually run */
  attempts?: number;
  /** True when an earlier attempt failed and a later one passed */
  flaky?: boolean;
}

export interface ReporterStartInfo {
  total: number;
}

export interface ReporterSummary {
  passed: number;
  failed: number;
  durationMs: number;
}

export interface Reporter {
  start(info: ReporterStartInfo): void | Promise<void>;
  testFinished(result: ReporterTestResult): void | Promise<void>;
  end(summary: ReporterSummary): void | Promise<void>;
}

export class MultiReporter implements Reporter {
  constructor(private readonly reporters: Reporter[]) {}

  async start(info: ReporterStartInfo): Promise<void> {
    for (const r of this.reporters) await r.start(info);
  }

  async testFinished(result: ReporterTestResult): Promise<void> {
    for (const r of this.reporters) await r.testFinished(result);
  }

  async end(summary: ReporterSummary): Promise<void> {
    for (const r of this.reporters) await r.end(summary);
  }
}

export class ConsoleReporter implements Reporter {
  start(_info: ReporterStartInfo): void {}

  testFinished(result: ReporterTestResult): void {
    const attemptLabel =
      result.attempts !== undefined && result.attempts > 1
        ? ` [attempt ${result.attempt ?? result.attempts}/${result.attempts}${result.flaky ? ', flaky' : ''}]`
        : '';
    if (result.ok) {
      console.log(`✓ PASS ${result.name} (${result.durationMs}ms)${attemptLabel}`);
    } else {
      console.error(`✗ FAIL ${result.name} (${result.durationMs}ms)${attemptLabel}`);
      if (result.error) console.error(`  ${result.error}`);
    }
  }

  end(summary: ReporterSummary): void {
    const total = summary.passed + summary.failed;
    console.log(`\nDone: ${summary.passed} passed, ${summary.failed} failed (${total} total, ${summary.durationMs}ms)`);
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

/** classname for JUnit: forward-slash path without drive quirks */
function junitClassname(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export class JUnitReporter implements Reporter {
  private results: ReporterTestResult[] = [];

  constructor(private readonly outputPath: string) {}

  start(_info: ReporterStartInfo): void {
    this.results = [];
  }

  testFinished(result: ReporterTestResult): void {
    this.results.push(result);
  }

  end(summary: ReporterSummary): void {
    const tests = this.results.length;
    const failures = this.results.filter((r) => !r.ok).length;
    const timeSec = (summary.durationMs / 1000).toFixed(3);
    const cases = this.results
      .map((r) => {
        const name = escapeXml(r.name);
        const classname = escapeXml(junitClassname(r.path));
        const time = (r.durationMs / 1000).toFixed(3);
        const systemOut =
          r.attempts !== undefined && r.attempts > 1
            ? `\n      <system-out>attempt ${r.attempt ?? r.attempts}/${r.attempts}${r.flaky ? ' flaky' : ''}</system-out>`
            : '';
        if (r.ok) {
          if (!systemOut) {
            return `    <testcase name="${name}" classname="${classname}" time="${time}"/>`;
          }
          return `    <testcase name="${name}" classname="${classname}" time="${time}">${systemOut}
    </testcase>`;
        }
        const msg = escapeXml(r.error ?? 'failed');
        const body = escapeXml(r.error ?? 'failed');
        return `    <testcase name="${name}" classname="${classname}" time="${time}">
      <failure message="${msg}">${body}</failure>${systemOut}
    </testcase>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="natl" tests="${tests}" failures="${failures}" time="${timeSec}">
  <testsuite name="natl" tests="${tests}" failures="${failures}" time="${timeSec}">
${cases}
  </testsuite>
</testsuites>
`;
    const abs = resolve(this.outputPath);
    ensureParentDir(abs);
    writeFileSync(abs, xml, 'utf8');
  }
}

export interface JsonReport {
  results: ReporterTestResult[];
  summary: ReporterSummary;
}

export class JsonReporter implements Reporter {
  private results: ReporterTestResult[] = [];

  constructor(private readonly outputPath: string) {}

  start(_info: ReporterStartInfo): void {
    this.results = [];
  }

  testFinished(result: ReporterTestResult): void {
    const entry: ReporterTestResult = {
      name: result.name,
      path: result.path,
      ok: result.ok,
      durationMs: result.durationMs,
      error: result.error,
    };
    if (result.attempt !== undefined) entry.attempt = result.attempt;
    if (result.attempts !== undefined) entry.attempts = result.attempts;
    if (result.flaky) entry.flaky = true;
    this.results.push(entry);
  }

  end(summary: ReporterSummary): void {
    const report: JsonReport = {
      results: this.results,
      summary,
    };
    const abs = resolve(this.outputPath);
    ensureParentDir(abs);
    writeFileSync(abs, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
}

export type ReporterName = 'console' | 'junit' | 'json';

export interface CreateReportersOptions {
  names: ReporterName[];
  /** Shared --output path; used by junit/json (see resolveFileOutput) */
  output?: string;
}

function resolveFileOutput(
  kind: 'junit' | 'json',
  names: ReporterName[],
  output: string | undefined,
): string {
  const fileReporters = names.filter((n) => n === 'junit' || n === 'json');
  if (output && fileReporters.length === 1 && fileReporters[0] === kind) {
    return output;
  }
  if (output && fileReporters.length > 1) {
    const lower = output.replace(/\\/g, '/').toLowerCase();
    if (kind === 'junit' && lower.endsWith('.xml')) return output;
    if (kind === 'json' && lower.endsWith('.json')) return output;
    // Treat as directory when both file reporters are active
    return resolve(output, kind === 'junit' ? 'junit.xml' : 'report.json');
  }
  return kind === 'junit' ? 'artifacts/junit.xml' : 'artifacts/report.json';
}

/** Build reporters from CLI-style names; default is console only. */
export function createReporters(options: CreateReportersOptions): Reporter {
  const names = options.names.length ? options.names : (['console'] as ReporterName[]);
  const unique = [...new Set(names)];
  const list: Reporter[] = [];
  for (const name of unique) {
    if (name === 'console') list.push(new ConsoleReporter());
    else if (name === 'junit') list.push(new JUnitReporter(resolveFileOutput('junit', unique, options.output)));
    else if (name === 'json') list.push(new JsonReporter(resolveFileOutput('json', unique, options.output)));
    else throw new Error(`Unknown reporter: ${name}`);
  }
  return list.length === 1 ? list[0]! : new MultiReporter(list);
}

export function parseReporterName(raw: string): ReporterName {
  const n = raw.trim().toLowerCase();
  if (n === 'console' || n === 'junit' || n === 'json') return n;
  throw new Error(`Unknown reporter "${raw}". Expected: console, junit, json`);
}
