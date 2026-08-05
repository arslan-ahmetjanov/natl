import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AllureReporter,
  allureHistoryId,
  createReporters,
  JUnitReporter,
  JsonReporter,
  parseReporterName,
  type ReporterTestResult,
} from './reporter.js';

function sampleResults(): ReporterTestResult[] {
  return [
    { name: 'login', path: 'tests/login.yaml', ok: true, durationMs: 120 },
    {
      name: 'checkout',
      path: 'tests/checkout.yaml',
      ok: false,
      durationMs: 340,
      error: 'assert failed: expected "OK" < & >',
    },
  ];
}

describe('parseReporterName', () => {
  it('accepts known names', () => {
    assert.equal(parseReporterName('JUnit'), 'junit');
    assert.equal(parseReporterName('json'), 'json');
    assert.equal(parseReporterName('console'), 'console');
    assert.equal(parseReporterName('allure'), 'allure');
  });

  it('rejects unknown', () => {
    assert.throws(() => parseReporterName('html'), /Unknown reporter/);
  });
});

describe('JUnitReporter', () => {
  it('writes parseable XML with failures', () => {
    const dir = join(tmpdir(), `natl-junit-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'junit.xml');
    const r = new JUnitReporter(out);
    r.start({ total: 2 });
    for (const t of sampleResults()) r.testFinished(t);
    r.end({ passed: 1, failed: 1, durationMs: 460 });

    const xml = readFileSync(out, 'utf8');
    assert.match(xml, /<testsuites[^>]*tests="2"[^>]*failures="1"/);
    assert.match(xml, /<testcase name="login"/);
    assert.match(xml, /<failure message=/);
    assert.match(xml, /&lt; &amp; &gt;/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('embeds attempt info in system-out without breaking testcase count', () => {
    const dir = join(tmpdir(), `natl-junit-retry-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'junit.xml');
    const r = new JUnitReporter(out);
    r.start({ total: 1 });
    r.testFinished({
      name: 'flaky',
      path: 'tests/flaky.yaml',
      ok: true,
      durationMs: 200,
      attempt: 2,
      attempts: 2,
      flaky: true,
    });
    r.end({ passed: 1, failed: 0, durationMs: 200 });

    const xml = readFileSync(out, 'utf8');
    assert.match(xml, /tests="1"/);
    assert.match(xml, /failures="0"/);
    assert.match(xml, /<property name="attempt" value="2"\/>/);
    assert.match(xml, /<property name="attempts" value="2"\/>/);
    assert.match(xml, /<property name="flaky" value="true"\/>/);
    assert.match(xml, /<flakyFailure message="passed after retry \(attempt 2\/2\)"\/>/);
    assert.match(xml, /<system-out>attempt 2\/2 flaky<\/system-out>/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('emits attempt properties on final failure after retries without flakyFailure', () => {
    const dir = join(tmpdir(), `natl-junit-retry-fail-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'junit.xml');
    const r = new JUnitReporter(out);
    r.start({ total: 1 });
    r.testFinished({
      name: 'still-bad',
      path: 'tests/still-bad.yaml',
      ok: false,
      durationMs: 100,
      error: 'boom',
      attempt: 2,
      attempts: 2,
    });
    r.end({ passed: 0, failed: 1, durationMs: 100 });

    const xml = readFileSync(out, 'utf8');
    assert.match(xml, /<failure message="boom"/);
    assert.match(xml, /<property name="attempt" value="2"\/>/);
    assert.match(xml, /<property name="attempts" value="2"\/>/);
    assert.doesNotMatch(xml, /flaky/);
    assert.doesNotMatch(xml, /flakyFailure/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes tags and attachment paths as properties and system-out', () => {
    const dir = join(tmpdir(), `natl-junit-enrich-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'junit.xml');
    const r = new JUnitReporter(out);
    r.start({ total: 1 });
    r.testFinished({
      name: 'login',
      path: 'tests/login.yaml',
      ok: false,
      durationMs: 50,
      error: 'timeout',
      tags: ['smoke', 'auth'],
      engine: 'playwright',
      attachments: [
        { name: 'screenshot', path: 'artifacts/login.png', type: 'image/png' },
      ],
    });
    r.end({ passed: 0, failed: 1, durationMs: 50 });

    const xml = readFileSync(out, 'utf8');
    assert.match(xml, /<property name="tags" value="smoke,auth"\/>/);
    assert.match(xml, /<property name="engine" value="playwright"\/>/);
    assert.match(
      xml,
      /<property name="attachment\.screenshot" value="artifacts\/login\.png"\/>/,
    );
    assert.match(xml, /<system-out>screenshot: artifacts\/login\.png<\/system-out>/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('JsonReporter', () => {
  it('writes results + summary with required fields', () => {
    const dir = join(tmpdir(), `natl-json-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'report.json');
    const r = new JsonReporter(out);
    r.start({ total: 2 });
    for (const t of sampleResults()) r.testFinished(t);
    r.end({ passed: 1, failed: 1, durationMs: 460 });

    const report = JSON.parse(readFileSync(out, 'utf8')) as {
      results: ReporterTestResult[];
      summary: { passed: number; failed: number; durationMs: number };
    };
    assert.equal(report.results.length, 2);
    assert.equal(report.results[0]!.name, 'login');
    assert.equal(report.results[0]!.ok, true);
    assert.equal(report.results[0]!.durationMs, 120);
    assert.equal(report.results[0]!.path, 'tests/login.yaml');
    assert.equal(report.results[1]!.error, 'assert failed: expected "OK" < & >');
    assert.deepEqual(report.summary, { passed: 1, failed: 1, durationMs: 460 });
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists attempt / flaky fields', () => {
    const dir = join(tmpdir(), `natl-json-retry-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'report.json');
    const r = new JsonReporter(out);
    r.start({ total: 1 });
    r.testFinished({
      name: 'flaky',
      path: 't.yaml',
      ok: true,
      durationMs: 10,
      attempt: 2,
      attempts: 2,
      flaky: true,
    });
    r.end({ passed: 1, failed: 0, durationMs: 10 });
    const report = JSON.parse(readFileSync(out, 'utf8')) as {
      results: ReporterTestResult[];
    };
    assert.equal(report.results[0]!.attempt, 2);
    assert.equal(report.results[0]!.attempts, 2);
    assert.equal(report.results[0]!.flaky, true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists tags, attachments, and engine', () => {
    const dir = join(tmpdir(), `natl-json-enrich-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'report.json');
    const r = new JsonReporter(out);
    r.start({ total: 1 });
    r.testFinished({
      name: 'login',
      path: 'tests/login.yaml',
      ok: false,
      durationMs: 50,
      error: 'timeout',
      tags: ['smoke', 'auth'],
      engine: 'playwright',
      attachments: [
        { name: 'screenshot', path: 'artifacts/login.png', type: 'image/png' },
        { name: 'trace', path: 'artifacts/login.zip', type: 'application/zip' },
        { name: 'video', path: 'artifacts/login.webm', type: 'video/webm' },
      ],
    });
    r.end({ passed: 0, failed: 1, durationMs: 50 });
    const report = JSON.parse(readFileSync(out, 'utf8')) as {
      results: ReporterTestResult[];
    };
    const entry = report.results[0]!;
    assert.deepEqual(entry.tags, ['smoke', 'auth']);
    assert.equal(entry.engine, 'playwright');
    assert.deepEqual(entry.attachments, [
      { name: 'screenshot', path: 'artifacts/login.png', type: 'image/png' },
      { name: 'trace', path: 'artifacts/login.zip', type: 'application/zip' },
      { name: 'video', path: 'artifacts/login.webm', type: 'video/webm' },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('createReporters', () => {
  it('defaults to console', () => {
    const r = createReporters({ names: [] });
    assert.ok(r);
  });

  it('routes --output to the single file reporter', async () => {
    const dir = join(tmpdir(), `natl-rep-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'custom.xml');
    const r = createReporters({ names: ['junit'], output: out });
    await r.start({ total: 1 });
    await r.testFinished(sampleResults()[0]!);
    await r.end({ passed: 1, failed: 0, durationMs: 10 });
    assert.ok(readFileSync(out, 'utf8').includes('login'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses directory when both junit and json share --output', async () => {
    const dir = join(tmpdir(), `natl-both-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.keep'), '');
    const r = createReporters({ names: ['junit', 'json'], output: dir });
    await r.start({ total: 1 });
    await r.testFinished(sampleResults()[0]!);
    await r.end({ passed: 1, failed: 0, durationMs: 5 });
    assert.ok(readFileSync(join(dir, 'junit.xml'), 'utf8').includes('testcase'));
    const json = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    assert.equal(json.results[0].name, 'login');
    rmSync(dir, { recursive: true, force: true });
  });

  it('nests allure-results when sharing a directory with junit', async () => {
    const dir = join(tmpdir(), `natl-allure-dir-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const r = createReporters({ names: ['junit', 'allure'], output: dir });
    await r.start({ total: 1 });
    await r.testFinished(sampleResults()[0]!);
    await r.end({ passed: 1, failed: 0, durationMs: 5 });
    assert.ok(readFileSync(join(dir, 'junit.xml'), 'utf8').includes('testcase'));
    const results = readdirSync(join(dir, 'allure-results')).filter((f) =>
      f.endsWith('-result.json'),
    );
    assert.equal(results.length, 1);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('AllureReporter', () => {
  it('writes stable historyId, tag labels, steps, and copies attachments', () => {
    const dir = join(tmpdir(), `natl-allure-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const shot = join(dir, 'fail.png');
    writeFileSync(shot, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const r = new AllureReporter(join(dir, 'results'));
    r.start({ total: 1 });
    r.testFinished({
      name: 'login',
      path: 'tests/login.yaml',
      ok: false,
      durationMs: 42,
      error: 'timeout',
      tags: ['smoke', 'auth'],
      engine: 'playwright',
      steps: [
        { name: 'goto "https://example.com"', ok: true, durationMs: 10 },
        { name: 'click "#submit"', ok: false, durationMs: 32, error: 'timeout' },
      ],
      attachments: [{ name: 'screenshot', path: shot, type: 'image/png' }],
    });
    r.end({ passed: 0, failed: 1, durationMs: 42 });

    const resultsDir = join(dir, 'results');
    const files = readdirSync(resultsDir);
    const resultFile = files.find((f) => f.endsWith('-result.json'));
    assert.ok(resultFile);
    const payload = JSON.parse(readFileSync(join(resultsDir, resultFile!), 'utf8')) as {
      historyId: string;
      status: string;
      labels: { name: string; value: string }[];
      steps: { name: string; status: string }[];
      attachments: { name: string; source: string; type: string }[];
    };
    assert.equal(payload.historyId, allureHistoryId('tests/login.yaml', 'login'));
    assert.equal(payload.status, 'failed');
    assert.ok(payload.labels.some((l) => l.name === 'tag' && l.value === 'smoke'));
    assert.ok(payload.labels.some((l) => l.name === 'tag' && l.value === 'auth'));
    assert.ok(payload.labels.some((l) => l.name === 'framework' && l.value === 'natl'));
    assert.equal(payload.steps.length, 2);
    assert.equal(payload.steps[1]!.status, 'failed');
    assert.equal(payload.attachments.length, 1);
    assert.equal(payload.attachments[0]!.name, 'screenshot');
    assert.ok(files.includes(payload.attachments[0]!.source));
    rmSync(dir, { recursive: true, force: true });
  });

  it('allureHistoryId is stable for same path+name', () => {
    assert.equal(
      allureHistoryId('a/b.yaml', 't'),
      allureHistoryId('a\\b.yaml', 't'),
    );
  });
});
