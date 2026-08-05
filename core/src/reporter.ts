import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export interface ReporterAttachment {
  name: string;
  path: string;
  /** MIME or short kind, e.g. image/png, application/zip, video/webm */
  type: string;
}

export interface ReporterStepResult {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

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
  /** Scenario tags from YAML root */
  tags?: string[];
  /** Artifact paths (screenshot / trace / video) */
  attachments?: ReporterAttachment[];
  /** Engine id used for the run, e.g. playwright */
  engine?: string;
  /** Flat step list from the interpreter (for Allure / rich reports) */
  steps?: ReporterStepResult[];
}

export interface ReporterStartInfo {
  total: number;
}

export interface ReporterSummary {
  passed: number;
  failed: number;
  durationMs: number;
}

export interface ReporterStepStartInfo {
  name: string;
}

export interface ReporterStepEndInfo {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface Reporter {
  start(info: ReporterStartInfo): void | Promise<void>;
  testFinished(result: ReporterTestResult): void | Promise<void>;
  end(summary: ReporterSummary): void | Promise<void>;
  /** Optional: fired around each interpreter step */
  stepStart?(info: ReporterStepStartInfo): void | Promise<void>;
  stepEnd?(info: ReporterStepEndInfo): void | Promise<void>;
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

  async stepStart(info: ReporterStepStartInfo): Promise<void> {
    for (const r of this.reporters) {
      if (r.stepStart) await r.stepStart(info);
    }
  }

  async stepEnd(info: ReporterStepEndInfo): Promise<void> {
    for (const r of this.reporters) {
      if (r.stepEnd) await r.stepEnd(info);
    }
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
        const hasRetryMeta = r.attempts !== undefined && r.attempts > 1;

        const systemOutLines: string[] = [];
        if (hasRetryMeta) {
          systemOutLines.push(
            `attempt ${r.attempt ?? r.attempts}/${r.attempts}${r.flaky ? ' flaky' : ''}`,
          );
        }
        for (const a of r.attachments ?? []) {
          systemOutLines.push(`${a.name}: ${a.path}`);
        }
        const systemOut =
          systemOutLines.length > 0
            ? `\n      <system-out>${escapeXml(systemOutLines.join('\n'))}</system-out>`
            : '';

        const props: string[] = [];
        if (r.tags?.length) {
          props.push(
            `      <property name="tags" value="${escapeXml(r.tags.join(','))}"/>`,
          );
        }
        if (r.engine) {
          props.push(`      <property name="engine" value="${escapeXml(r.engine)}"/>`);
        }
        if (hasRetryMeta) {
          props.push(
            `      <property name="attempt" value="${escapeXml(String(r.attempt ?? r.attempts))}"/>`,
          );
          props.push(
            `      <property name="attempts" value="${escapeXml(String(r.attempts))}"/>`,
          );
          if (r.flaky) {
            props.push(`      <property name="flaky" value="true"/>`);
          }
        }
        for (const a of r.attachments ?? []) {
          props.push(
            `      <property name="attachment.${a.name}" value="${escapeXml(a.path)}"/>`,
          );
        }
        const properties =
          props.length > 0 ? `\n      <properties>\n${props.join('\n')}\n      </properties>` : '';

        // Surefire-compatible marker for pass-after-retry (Jenkins Flaky Test Handler, etc.).
        // No prior-attempt stack: NATL only retains the final attempt in the reporter model.
        const flakyFailure =
          r.ok && r.flaky
            ? `\n      <flakyFailure message="${escapeXml(
                `passed after retry (attempt ${r.attempt ?? r.attempts}/${r.attempts})`,
              )}"/>`
            : '';

        const inner = `${properties}${flakyFailure}${systemOut}`;
        if (r.ok) {
          if (!inner) {
            return `    <testcase name="${name}" classname="${classname}" time="${time}"/>`;
          }
          return `    <testcase name="${name}" classname="${classname}" time="${time}">${inner}
    </testcase>`;
        }
        const msg = escapeXml(r.error ?? 'failed');
        const body = escapeXml(r.error ?? 'failed');
        return `    <testcase name="${name}" classname="${classname}" time="${time}">
      <failure message="${msg}">${body}</failure>${inner}
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
    if (result.tags?.length) entry.tags = [...result.tags];
    if (result.attachments?.length) {
      entry.attachments = result.attachments.map((a) => ({
        name: a.name,
        path: a.path,
        type: a.type,
      }));
    }
    if (result.engine) entry.engine = result.engine;
    if (result.steps?.length) {
      entry.steps = result.steps.map((s) => ({
        name: s.name,
        ok: s.ok,
        durationMs: s.durationMs,
        error: s.error,
      }));
    }
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

/** Stable Allure historyId from scenario path + display name. */
export function allureHistoryId(path: string, name: string): string {
  return createHash('md5').update(`${path.replace(/\\/g, '/')}\0${name}`).digest('hex');
}

function attachmentExt(type: string, sourcePath: string): string {
  const fromPath = extname(sourcePath).replace(/^\./, '');
  if (fromPath) return fromPath;
  if (type.includes('png')) return 'png';
  if (type.includes('zip')) return 'zip';
  if (type.includes('webm')) return 'webm';
  return 'bin';
}

/** Writes Allure 2 `*-result.json` (+ copied attachments) without allure-js-commons. */
export class AllureReporter implements Reporter {
  private liveSteps: ReporterStepResult[] = [];

  constructor(private readonly resultsDir: string) {}

  start(_info: ReporterStartInfo): void {
    mkdirSync(resolve(this.resultsDir), { recursive: true });
    this.liveSteps = [];
  }

  stepStart(_info: ReporterStepStartInfo): void {}

  stepEnd(info: ReporterStepEndInfo): void {
    this.liveSteps.push({
      name: info.name,
      ok: info.ok,
      durationMs: info.durationMs,
      error: info.error,
    });
  }

  testFinished(result: ReporterTestResult): void {
    const dir = resolve(this.resultsDir);
    mkdirSync(dir, { recursive: true });
    const uuid = randomUUID();
    const stop = Date.now();
    const start = stop - Math.max(0, result.durationMs);
    const stepsSource = result.steps?.length ? result.steps : this.liveSteps;
    const steps = stepsSource.map((s) => {
      const sStop = start + Math.max(0, s.durationMs);
      return {
        name: s.name,
        status: s.ok ? 'passed' : 'failed',
        stage: 'finished',
        start,
        stop: sStop,
        statusDetails: s.error ? { message: s.error } : undefined,
        steps: [] as unknown[],
        attachments: [] as unknown[],
        parameters: [] as unknown[],
      };
    });

    const attachments: { name: string; source: string; type: string }[] = [];
    for (const a of result.attachments ?? []) {
      if (!a.path || !existsSync(a.path)) continue;
      const attUuid = randomUUID();
      const ext = attachmentExt(a.type, a.path);
      const sourceName = `${attUuid}-attachment.${ext}`;
      try {
        copyFileSync(a.path, resolve(dir, sourceName));
        attachments.push({ name: a.name, source: sourceName, type: a.type });
      } catch {
        // skip unreadable artifacts
      }
    }

    const labels: { name: string; value: string }[] = [
      { name: 'framework', value: 'natl' },
      { name: 'language', value: 'yaml' },
      { name: 'package', value: junitClassname(dirname(result.path) || '.') },
      { name: 'testClass', value: junitClassname(result.path) },
      { name: 'testMethod', value: result.name },
    ];
    if (result.engine) labels.push({ name: 'parentSuite', value: result.engine });
    for (const tag of result.tags ?? []) {
      labels.push({ name: 'tag', value: tag });
    }

    const payload = {
      uuid,
      historyId: allureHistoryId(result.path, result.name),
      testCaseId: allureHistoryId(result.path, result.name),
      fullName: `${junitClassname(result.path)}#${result.name}`,
      name: result.name,
      status: result.ok ? 'passed' : 'failed',
      stage: 'finished',
      start,
      stop,
      statusDetails: result.error
        ? { message: result.error, flaky: result.flaky === true }
        : result.flaky
          ? { flaky: true }
          : undefined,
      labels,
      links: [] as unknown[],
      steps,
      attachments,
      parameters: [] as unknown[],
    };

    writeFileSync(resolve(dir, `${uuid}-result.json`), JSON.stringify(payload) + '\n', 'utf8');
    this.liveSteps = [];
  }

  end(_summary: ReporterSummary): void {
    this.liveSteps = [];
  }
}

export type ReporterName = 'console' | 'junit' | 'json' | 'allure';

export interface CreateReportersOptions {
  names: ReporterName[];
  /** Shared --output path; used by junit/json/allure (see resolve*Output) */
  output?: string;
}

function resolveFileOutput(
  kind: 'junit' | 'json',
  names: ReporterName[],
  output: string | undefined,
): string {
  const fileReporters = names.filter((n) => n === 'junit' || n === 'json');
  const lower = output?.replace(/\\/g, '/').toLowerCase() ?? '';
  const outputLooksLikeFile =
    lower.endsWith('.xml') || lower.endsWith('.json');

  if (output && fileReporters.length === 1 && fileReporters[0] === kind && outputLooksLikeFile) {
    return output;
  }
  if (output && (fileReporters.length > 1 || (names.includes('allure') && !outputLooksLikeFile))) {
    if (kind === 'junit' && lower.endsWith('.xml')) return output;
    if (kind === 'json' && lower.endsWith('.json')) return output;
    // Treat as directory when multiple file reporters or shared with allure
    return resolve(output, kind === 'junit' ? 'junit.xml' : 'report.json');
  }
  if (output && fileReporters.length === 1 && fileReporters[0] === kind) {
    return output;
  }
  return kind === 'junit' ? 'artifacts/junit.xml' : 'artifacts/report.json';
}

function resolveAllureOutput(names: ReporterName[], output: string | undefined): string {
  if (!output) return 'allure-results';
  const lower = output.replace(/\\/g, '/').toLowerCase();
  if (lower.endsWith('.xml') || lower.endsWith('.json')) return 'allure-results';
  const fileReporters = names.filter((n) => n === 'junit' || n === 'json');
  // Alone (or with console): --output is the results directory
  if (fileReporters.length === 0) return output;
  // Shared directory with junit/json → nest allure-results inside
  return resolve(output, 'allure-results');
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
    else if (name === 'allure') list.push(new AllureReporter(resolveAllureOutput(unique, options.output)));
    else throw new Error(`Unknown reporter: ${name}`);
  }
  return list.length === 1 ? list[0]! : new MultiReporter(list);
}

export function parseReporterName(raw: string): ReporterName {
  const n = raw.trim().toLowerCase();
  if (n === 'console' || n === 'junit' || n === 'json' || n === 'allure') return n;
  throw new Error(`Unknown reporter "${raw}". Expected: console, junit, json, allure`);
}
