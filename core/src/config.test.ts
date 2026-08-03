import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  findProjectConfigPath,
  loadMergedProjectConfig,
  loadProjectConfig,
  mergeProjectConfigs,
  parseProjectConfig,
  resolveEnvProfilePath,
  resolveRunSettings,
} from './config.js';

describe('parseProjectConfig', () => {
  it('parses known fields', () => {
    const cfg = parseProjectConfig({
      engine: 'playwright',
      timeout: 15000,
      base_url: 'https://staging.example.com',
      headless: true,
      artifacts_dir: 'artifacts',
      retries: 2,
      trace: 'on',
      video: 'on-fail',
    });
    assert.equal(cfg.engine, 'playwright');
    assert.equal(cfg.timeout, 15000);
    assert.equal(cfg.base_url, 'https://staging.example.com');
    assert.equal(cfg.headless, true);
    assert.equal(cfg.artifacts_dir, 'artifacts');
    assert.equal(cfg.retries, 2);
    assert.equal(cfg.trace, 'on');
    assert.equal(cfg.video, 'on-fail');
  });

  it('parses browser and viewport', () => {
    const cfg = parseProjectConfig({
      browser: 'firefox',
      viewport: { width: 390, height: 844 },
    });
    assert.equal(cfg.browser, 'firefox');
    assert.deepEqual(cfg.viewport, { width: 390, height: 844 });
  });

  it('parses locator_strategy', () => {
    const cfg = parseProjectConfig({ locator_strategy: 'xpath' });
    assert.equal(cfg.locator_strategy, 'xpath');
    assert.equal(resolveRunSettings({ config: cfg }).locatorStrategy, 'xpath');
  });

  it('rejects invalid browser / viewport', () => {
    assert.throws(() => parseProjectConfig({ browser: '' }), /browser/);
    assert.throws(() => parseProjectConfig({ viewport: { width: 0, height: 100 } }), /viewport/);
    assert.throws(() => parseProjectConfig({ viewport: true }), /viewport/);
  });

  it('rejects invalid timeout', () => {
    assert.throws(() => parseProjectConfig({ timeout: -1 }), /timeout/);
  });

  it('rejects invalid retries', () => {
    assert.throws(() => parseProjectConfig({ retries: -1 }), /retries/);
  });

  it('rejects invalid trace/video mode', () => {
    assert.throws(() => parseProjectConfig({ trace: 'always' }), /trace/);
    assert.throws(() => parseProjectConfig({ video: true }), /video/);
  });

  it('parses soft_assert_screenshot', () => {
    const cfg = parseProjectConfig({ soft_assert_screenshot: true });
    assert.equal(cfg.soft_assert_screenshot, true);
    assert.throws(() => parseProjectConfig({ soft_assert_screenshot: 'yes' }), /soft_assert_screenshot/);
  });
});

describe('findProjectConfigPath / loadProjectConfig', () => {
  it('walks up to find natl.config.yaml', () => {
    const root = join(tmpdir(), `natl-cfg-${Date.now()}`);
    const nested = join(root, 'tests', 'auth');
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(root, 'natl.config.yaml'),
      'engine: playwright\ntimeout: 12000\nbase_url: https://example.com\n',
    );
    try {
      assert.equal(findProjectConfigPath(nested), join(root, 'natl.config.yaml'));
      const cfg = loadProjectConfig(nested);
      assert.ok(cfg);
      assert.equal(cfg!.timeout, 12000);
      assert.equal(cfg!.base_url, 'https://example.com');
      assert.equal(cfg!.path, join(root, 'natl.config.yaml'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prefers .yaml over walking further', () => {
    const root = join(tmpdir(), `natl-cfg2-${Date.now()}`);
    const nested = join(root, 'tests');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, 'natl.config.yaml'), 'timeout: 1\n');
    writeFileSync(join(nested, 'natl.config.yml'), 'timeout: 2\n');
    try {
      const cfg = loadProjectConfig(nested);
      assert.equal(cfg!.timeout, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('resolveRunSettings', () => {
  const config = parseProjectConfig({
    engine: 'playwright',
    timeout: 15000,
    headless: true,
    artifacts_dir: 'out',
    base_url: 'https://cfg.example',
  });

  it('passes browser and viewport from config', () => {
    const s = resolveRunSettings({
      config: parseProjectConfig({
        browser: 'webkit',
        viewport: { width: 1280, height: 720 },
      }),
    });
    assert.equal(s.browser, 'webkit');
    assert.deepEqual(s.viewport, { width: 1280, height: 720 });
  });

  it('uses config when test omits engine/timeout', () => {
    const s = resolveRunSettings({ config });
    assert.equal(s.engine, 'playwright');
    assert.equal(s.timeout, 15000);
    assert.equal(s.headless, true);
    assert.equal(s.artifactsDir, 'out');
    assert.equal(s.baseUrl, 'https://cfg.example');
  });

  it('lets test YAML override timeout and engine', () => {
    const s = resolveRunSettings({
      config,
      test: { engine: 'custom', timeout: 5000 },
    });
    assert.equal(s.engine, 'custom');
    assert.equal(s.timeout, 5000);
  });

  it('lets CLI --engine and --headed win over config', () => {
    const s = resolveRunSettings({
      config,
      test: { engine: 'from-test', timeout: 1000 },
      cli: { engine: 'from-cli', headless: false },
    });
    assert.equal(s.engine, 'from-cli');
    assert.equal(s.headless, false);
    assert.equal(s.timeout, 1000);
  });

  it('merges retries CLI > test > config > 0', () => {
    const withRetries = parseProjectConfig({ retries: 3 });
    assert.equal(resolveRunSettings({ config: withRetries }).retries, 3);
    assert.equal(
      resolveRunSettings({ config: withRetries, test: { retries: 1 } }).retries,
      1,
    );
    assert.equal(
      resolveRunSettings({
        config: withRetries,
        test: { retries: 1 },
        cli: { retries: 5 },
      }).retries,
      5,
    );
    assert.equal(resolveRunSettings({}).retries, 0);
  });

  it('defaults trace on-fail and video off; CLI overrides config', () => {
    assert.equal(resolveRunSettings({}).trace, 'on-fail');
    assert.equal(resolveRunSettings({}).video, 'off');
    const cfg = parseProjectConfig({ trace: 'off', video: 'on' });
    assert.equal(resolveRunSettings({ config: cfg }).trace, 'off');
    assert.equal(resolveRunSettings({ config: cfg }).video, 'on');
    assert.equal(
      resolveRunSettings({ config: cfg, cli: { trace: 'on', video: 'on-fail' } }).trace,
      'on',
    );
    assert.equal(
      resolveRunSettings({ config: cfg, cli: { trace: 'on', video: 'on-fail' } }).video,
      'on-fail',
    );
  });
});

describe('mergeProjectConfigs / env profiles', () => {
  it('lets overlay override base_url and keep other base fields', () => {
    const base = parseProjectConfig(
      {
        engine: 'playwright',
        timeout: 15000,
        base_url: 'https://base.example',
        headless: true,
      },
      '/proj/natl.config.yaml',
    );
    const overlay = parseProjectConfig(
      { base_url: 'https://staging.example' },
      '/proj/config/staging.yaml',
    );
    const merged = mergeProjectConfigs(base, overlay)!;
    assert.equal(merged.base_url, 'https://staging.example');
    assert.equal(merged.timeout, 15000);
    assert.equal(merged.engine, 'playwright');
    assert.equal(merged.path, '/proj/natl.config.yaml');
    assert.equal(merged.profilePath, '/proj/config/staging.yaml');
  });

  it('resolveRunSettings uses merged config base_url', () => {
    const base = parseProjectConfig({ base_url: 'https://base.example', timeout: 10 });
    const overlay = parseProjectConfig({ base_url: 'https://staging.example' });
    const s = resolveRunSettings({ config: mergeProjectConfigs(base, overlay) });
    assert.equal(s.baseUrl, 'https://staging.example');
    assert.equal(s.timeout, 10);
  });

  it('loadMergedProjectConfig applies --env overlay', () => {
    const root = join(tmpdir(), `natl-env-${Date.now()}`);
    const tests = join(root, 'tests');
    mkdirSync(join(root, 'config'), { recursive: true });
    mkdirSync(tests, { recursive: true });
    writeFileSync(
      join(root, 'natl.config.yaml'),
      'engine: playwright\ntimeout: 9000\nbase_url: https://base.example\n',
    );
    writeFileSync(join(root, 'config', 'staging.yaml'), 'base_url: https://staging.example\n');
    try {
      const cfg = loadMergedProjectConfig({ startDir: tests, env: 'staging' });
      assert.ok(cfg);
      assert.equal(cfg!.base_url, 'https://staging.example');
      assert.equal(cfg!.timeout, 9000);
      assert.equal(cfg!.path, join(root, 'natl.config.yaml'));
      assert.equal(cfg!.profilePath, join(root, 'config', 'staging.yaml'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loadMergedProjectConfig without env matches loadProjectConfig', () => {
    const root = join(tmpdir(), `natl-env2-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'natl.config.yaml'), 'base_url: https://only-base.example\n');
    try {
      const a = loadProjectConfig(root);
      const b = loadMergedProjectConfig({ startDir: root });
      assert.equal(b!.base_url, a!.base_url);
      assert.equal(b!.path, a!.path);
      assert.equal(b!.profilePath, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when --env profile is missing', () => {
    const root = join(tmpdir(), `natl-env3-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'natl.config.yaml'), 'timeout: 1\n');
    try {
      assert.throws(
        () => loadMergedProjectConfig({ startDir: root, env: 'missing' }),
        /Env profile not found/,
      );
      assert.throws(() => resolveEnvProfilePath(root, 'nope'), /Env profile not found/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when both env and configPath are set', () => {
    assert.throws(
      () =>
        loadMergedProjectConfig({
          startDir: process.cwd(),
          env: 'staging',
          configPath: 'config/staging.yaml',
        }),
      /either --env or --config/,
    );
  });

  it('loadMergedProjectConfig applies --config overlay path', () => {
    const root = join(tmpdir(), `natl-env4-${Date.now()}`);
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'natl.config.yaml'), 'base_url: https://base.example\n');
    const profile = join(root, 'config', 'custom.yaml');
    writeFileSync(profile, 'base_url: https://custom.example\n');
    try {
      const cfg = loadMergedProjectConfig({ startDir: root, configPath: profile });
      assert.equal(cfg!.base_url, 'https://custom.example');
      assert.equal(cfg!.profilePath, profile);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
