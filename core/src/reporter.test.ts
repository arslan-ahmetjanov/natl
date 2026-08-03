import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
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
  });

  it('rejects unknown', () => {
    assert.throws(() => parseReporterName('allure'), /Unknown reporter/);
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
    assert.match(xml, /<system-out>attempt 2\/2 flaky<\/system-out>/);
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
});
