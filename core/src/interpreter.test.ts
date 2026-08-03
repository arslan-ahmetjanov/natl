import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  AdapterFactory,
  EngineAdapter,
  FinalizeArtifactsOptions,
  FinalizeArtifactsResult,
} from './adapter.js';
import { runNatlFile, resolveDoTarget } from './interpreter.js';

/** Minimal EngineAdapter v2 mock; override per test. */
function stubAdapter(overrides: Partial<EngineAdapter> = {}): EngineAdapter {
  return {
    goto: async () => undefined,
    click: async () => undefined,
    fill: async () => undefined,
    select: async () => undefined,
    check: async () => undefined,
    uncheck: async () => undefined,
    wait: async () => undefined,
    waitMs: async () => undefined,
    screenshot: async () => undefined,
    getText: async () => '',
    getAttr: async () => null,
    isVisible: async () => true,
    getCurrentUrl: async () => 'about:blank',
    scroll: async () => undefined,
    swipe: async () => undefined,
    longPress: async () => undefined,
    dispose: async () => undefined,
    ...overrides,
  };
}

describe('resolveDoTarget', () => {
  it('resolves page.action', () => {
    const reg = new Map([['login/login', {}]]);
    assert.deepEqual(resolveDoTarget('login.login', reg), {
      file: 'login',
      action: 'login',
    });
  });

  it('resolves unambiguous short action', () => {
    const reg = new Map([
      ['login/login', {}],
      ['login', {}],
    ]);
    assert.deepEqual(resolveDoTarget('login', reg), {
      file: 'login',
      action: 'login',
    });
  });

  it('rejects ambiguous short action', () => {
    const reg = new Map([
      ['login/login', {}],
      ['checkout/login', {}],
      ['login', {}],
    ]);
    assert.throws(() => resolveDoTarget('login', reg), /ambiguous/);
  });
});

describe('cases:', () => {
  it('runs each case as a separate result', async () => {
    const dir = join(tmpdir(), `natl-cases-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'cases.yaml');
    writeFileSync(
      file,
      `name: Cases demo
engine: mock
cases:
  - { name: a, x: "1" }
  - { name: b, x: "2" }
steps:
  - log: "x=$x"
`,
    );

    try {
      const factory: AdapterFactory = async () => stubAdapter();

      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, true);
      assert.equal(result.caseResults?.length, 2);
      assert.equal(result.caseResults![0]!.name, 'Cases demo [a]');
      assert.equal(result.caseResults![1]!.name, 'Cases demo [b]');
      assert.equal(result.caseResults![0]!.ok, true);
      assert.equal(result.caseResults![1]!.ok, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('identifies a failing case in caseResults', async () => {
    const dir = join(tmpdir(), `natl-cases-fail-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'cases.yaml');
    writeFileSync(
      file,
      `name: Cases fail
engine: mock
cases:
  - { name: ok, want: "yes" }
  - { name: bad, want: "no" }
steps:
  - assert: ".t"
    text: $want
`,
    );

    try {
      const factory: AdapterFactory = async () => stubAdapter({ getText: async () => 'yes' });

      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, false);
      assert.equal(result.caseResults?.length, 2);
      assert.equal(result.caseResults![0]!.ok, true);
      assert.equal(result.caseResults![1]!.ok, false);
      assert.equal(result.caseResults![1]!.name, 'Cases fail [bad]');
      assert.match(result.error ?? '', /Cases fail \[bad\]/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function createFlakyFactory(failFirstN: number): {
  factory: AdapterFactory;
  creations: () => number;
  screenshots: () => string[];
} {
  let creations = 0;
  const screenshots: string[] = [];

  const factory: AdapterFactory = async () => {
    const id = ++creations;
    return stubAdapter({
      goto: async () => {
        if (id <= failFirstN) throw new Error(`flaky fail on attempt ${id}`);
      },
      screenshot: async (file) => {
        screenshots.push(file);
      },
    });
  };

  return {
    factory,
    creations: () => creations,
    screenshots: () => screenshots,
  };
}

function createTraceFactory(opts?: {
  fail?: boolean;
  finalizeError?: boolean;
}): {
  factory: AdapterFactory;
  finalizeCalls: () => FinalizeArtifactsOptions[];
} {
  const finalizeCalls: FinalizeArtifactsOptions[] = [];

  const factory: AdapterFactory = async () =>
    stubAdapter({
      goto: async () => {
        if (opts?.fail !== false) throw new Error('boom');
      },
      finalizeArtifacts: async (o): Promise<FinalizeArtifactsResult> => {
        finalizeCalls.push(o);
        if (opts?.finalizeError) throw new Error('trace write failed');
        if (o.ok) return {};
        return {
          tracePath: join(o.artifactsDir, `${o.baseName}.zip`),
          videoPath: join(o.artifactsDir, `${o.baseName}.webm`),
        };
      },
    });

  return { factory, finalizeCalls: () => finalizeCalls };
}

describe('retries', () => {
  it('passes when first attempt fails and retry succeeds (--retries 1)', async () => {
    const dir = join(tmpdir(), `natl-retry-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'flaky.yaml');
    writeFileSync(
      file,
      `name: Flaky checkout
engine: mock
steps:
  - goto: about:blank
`,
    );

    try {
      const mock = createFlakyFactory(1);
      const result = await runNatlFile({
        file,
        projectConfig: null,
        retries: 1,
        adapters: { mock: mock.factory },
        logger: () => undefined,
      });

      assert.equal(result.ok, true);
      assert.equal(result.attempt, 2);
      assert.equal(result.attempts, 2);
      assert.equal(result.flaky, true);
      assert.equal(mock.creations(), 2);
      assert.equal(mock.screenshots().length, 1);
      assert.match(mock.screenshots()[0]!, /attempt-1\.png$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails with last attempt when all attempts fail', async () => {
    const dir = join(tmpdir(), `natl-retry-fail-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'always-fail.yaml');
    writeFileSync(
      file,
      `name: Always fail
engine: mock
retries: 1
steps:
  - goto: about:blank
`,
    );

    try {
      const mock = createFlakyFactory(99);
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: () => undefined,
      });

      assert.equal(result.ok, false);
      assert.equal(result.attempt, 2);
      assert.equal(result.attempts, 2);
      assert.equal(result.flaky, undefined);
      assert.match(result.error ?? '', /flaky fail on attempt 2/);
      assert.equal(mock.creations(), 2);
      assert.equal(mock.screenshots().length, 2);
      assert.match(mock.screenshots()[0]!, /attempt-1\.png$/);
      assert.match(mock.screenshots()[1]!, /attempt-2\.png$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not retry when retries is 0', async () => {
    const dir = join(tmpdir(), `natl-retry-zero-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'once.yaml');
    writeFileSync(
      file,
      `name: Once
engine: mock
steps:
  - goto: about:blank
`,
    );

    try {
      const mock = createFlakyFactory(1);
      const result = await runNatlFile({
        file,
        projectConfig: null,
        retries: 0,
        adapters: { mock: mock.factory },
        logger: () => undefined,
      });

      assert.equal(result.ok, false);
      assert.equal(result.attempts, 1);
      assert.equal(mock.creations(), 1);
      assert.equal(mock.screenshots().length, 1);
      assert.ok(!/attempt-/.test(mock.screenshots()[0]!));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('trace / video artifacts', () => {
  it('calls finalizeArtifacts on fail and returns paths', async () => {
    const dir = join(tmpdir(), `natl-trace-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'fail.yaml');
    writeFileSync(
      file,
      `name: Trace fail
engine: mock
steps:
  - goto: about:blank
`,
    );

    try {
      const mock = createTraceFactory({ fail: true });
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, false);
      assert.equal(mock.finalizeCalls().length, 1);
      assert.equal(mock.finalizeCalls()[0]!.ok, false);
      assert.match(result.tracePath ?? '', /\.zip$/);
      assert.match(result.videoPath ?? '', /\.webm$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not call finalizeArtifacts when --trace off and --video off', async () => {
    const dir = join(tmpdir(), `natl-trace-off-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'fail.yaml');
    writeFileSync(
      file,
      `name: No trace
engine: mock
steps:
  - goto: about:blank
`,
    );

    try {
      const mock = createTraceFactory({ fail: true });
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: () => undefined,
        screenshot: false,
        trace: 'off',
        video: 'off',
      });

      assert.equal(result.ok, false);
      assert.equal(mock.finalizeCalls().length, 0);
      assert.equal(result.tracePath, undefined);
      assert.equal(result.videoPath, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('soft-fails when finalizeArtifacts throws', async () => {
    const dir = join(tmpdir(), `natl-trace-soft-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'fail.yaml');
    writeFileSync(
      file,
      `name: Soft trace
engine: mock
steps:
  - goto: about:blank
`,
    );
    const warns: string[] = [];

    try {
      const mock = createTraceFactory({ fail: true, finalizeError: true });
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: (level, msg) => {
          if (level === 'warn') warns.push(msg);
        },
        screenshot: false,
      });

      assert.equal(result.ok, false);
      assert.match(result.error ?? '', /boom/);
      assert.equal(result.tracePath, undefined);
      assert.ok(warns.some((w) => /Trace\/video failed/.test(w)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('soft asserts', () => {
  function createSoftAssertFactory(): {
    factory: AdapterFactory;
    clicks: () => string[];
    screenshots: () => string[];
  } {
    const clicks: string[] = [];
    const screenshots: string[] = [];
    const factory: AdapterFactory = async () =>
      stubAdapter({
        click: async (locator) => {
          clicks.push(locator.value);
        },
        screenshot: async (file) => {
          screenshots.push(file);
        },
        getText: async (locator) => {
          if (locator.value === '.price') return '$99';
          if (locator.value === '.ok') return 'OK';
          return '';
        },
        isVisible: async (locator) => locator.value !== '.stock',
      });
    return { factory, clicks: () => clicks, screenshots: () => screenshots };
  }

  it('collects two soft failures, continues steps, fails at end', async () => {
    const dir = join(tmpdir(), `natl-soft-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'soft.yaml');
    writeFileSync(
      file,
      `name: Soft demo
engine: mock
steps:
  - soft_assert: ".price" text: "$10"
  - soft_assert: ".stock" visible
  - soft_assert: ".ok" text: "OK"
  - click: "#next"
`,
    );
    const logs: string[] = [];

    try {
      const mock = createSoftAssertFactory();
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: (_level, msg) => logs.push(msg),
        screenshot: false,
      });

      assert.equal(result.ok, false);
      assert.match(result.error ?? '', /Soft assert failures \(2\)/);
      assert.match(result.error ?? '', /\.price/);
      assert.match(result.error ?? '', /\.stock/);
      assert.deepEqual(mock.clicks(), ['#next']);
      assert.ok(logs.some((l) => /soft_assert text "\.price"/.test(l)));
      assert.ok(logs.some((l) => /soft_assert visible "\.stock"/.test(l)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hard assert still fail-fast before later steps', async () => {
    const dir = join(tmpdir(), `natl-hard-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'hard.yaml');
    writeFileSync(
      file,
      `name: Hard demo
engine: mock
steps:
  - soft_assert: ".price" text: "$10"
  - assert: ".price" text: "$10"
  - click: "#next"
`,
    );

    try {
      const mock = createSoftAssertFactory();
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, false);
      assert.match(result.error ?? '', /assert text/);
      assert.ok(!/Soft assert failures/.test(result.error ?? ''));
      assert.equal(mock.clicks().length, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('takes screenshots per soft fail when enabled', async () => {
    const dir = join(tmpdir(), `natl-soft-shot-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'soft.yaml');
    writeFileSync(
      file,
      `name: Soft shots
engine: mock
steps:
  - soft_assert: ".price" text: "$10"
  - soft_assert: ".stock" visible
`,
    );

    try {
      const mock = createSoftAssertFactory();
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: () => undefined,
        screenshot: false,
        softAssertScreenshot: true,
      });

      assert.equal(result.ok, false);
      const softShots = mock.screenshots().filter((p) => /-soft-\d+\.png$/.test(p));
      assert.equal(softShots.length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports assert with soft: true', async () => {
    const dir = join(tmpdir(), `natl-soft-flag-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'soft.yaml');
    writeFileSync(
      file,
      `name: Soft flag
engine: mock
steps:
  - assert: ".price"
    text: "$10"
    soft: true
  - click: "#next"
`,
    );

    try {
      const mock = createSoftAssertFactory();
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: mock.factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, false);
      assert.match(result.error ?? '', /Soft assert failures \(1\)/);
      assert.deepEqual(mock.clicks(), ['#next']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports assert contains on locator text', async () => {
    const dir = join(tmpdir(), `natl-contains-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'c.yaml');
    writeFileSync(
      file,
      `name: Contains
engine: mock
steps:
  - assert: ".welcome"
    contains: "Hell"
`,
    );

    try {
      const factory: AdapterFactory = async () =>
        stubAdapter({ getText: async () => 'Hello world' });

      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, true, result.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('do: POM actions', () => {
  it('runs do: page.action with sibling args', async () => {
    const dir = join(tmpdir(), `natl-do-${Date.now()}`);
    mkdirSync(join(dir, 'pages'), { recursive: true });
    writeFileSync(
      join(dir, 'pages', 'login.yaml'),
      `name: LoginPage
elements:
  email_input: "#email"
actions:
  login:
    - fill: $email_input
      with: $user
    - click: "#login-btn"
`,
    );
    const file = join(dir, 't.yaml');
    writeFileSync(
      file,
      `name: Do login
engine: mock
imports:
  - pages/login.yaml
steps:
  - do: login.login
    user: demo
  - log: ok
`,
    );

    try {
      const fills: string[] = [];
      const clicks: string[] = [];
      const factory: AdapterFactory = async () =>
        stubAdapter({
          click: async (sel) => {
            clicks.push(sel.value);
          },
          fill: async (sel, value) => {
            fills.push(`${sel.value}=${value}`);
          },
        });

      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, true, result.error);
      assert.deepEqual(fills, ['#email=demo']);
      assert.deepEqual(clicks, ['#login-btn']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps include: page/action working', async () => {
    const dir = join(tmpdir(), `natl-include-${Date.now()}`);
    mkdirSync(join(dir, 'pages'), { recursive: true });
    writeFileSync(
      join(dir, 'pages', 'login.yaml'),
      `name: LoginPage
actions:
  login:
    - click: "#login-btn"
`,
    );
    const file = join(dir, 't.yaml');
    writeFileSync(
      file,
      `name: Include login
engine: mock
imports:
  - pages/login.yaml
steps:
  - include: login/login
`,
    );

    try {
      const clicks: string[] = [];
      const factory: AdapterFactory = async () =>
        stubAdapter({
          click: async (sel) => {
            clicks.push(sel.value);
          },
        });

      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, true, result.error);
      assert.deepEqual(clicks, ['#login-btn']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes xpath LocatorRef from mixed elements', async () => {
    const dir = join(tmpdir(), `natl-loc-${Date.now()}`);
    mkdirSync(join(dir, 'pages'), { recursive: true });
    writeFileSync(
      join(dir, 'pages', 'login.yaml'),
      `name: LoginPage
locator_strategy: css
elements:
  email: "#email"
  title:
    strategy: xpath
    value: "//h1"
actions:
  check:
    - assert: $title
      visible: true
    - click: $email
`,
    );
    const file = join(dir, 't.yaml');
    writeFileSync(
      file,
      `name: Locator model
engine: mock
imports:
  - pages/login.yaml
steps:
  - do: login.check
`,
    );

    try {
      const seen: { strategy: string; value: string }[] = [];
      const factory: AdapterFactory = async () =>
        stubAdapter({
          isVisible: async (loc) => {
            seen.push({ ...loc });
            return true;
          },
          click: async (loc) => {
            seen.push({ ...loc });
          },
        });

      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });

      assert.equal(result.ok, true, result.error);
      assert.deepEqual(seen, [
        { strategy: 'xpath', value: '//h1' },
        { strategy: 'css', value: '#email' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('with: http', () => {
  it('runs HTTP block and tags FAIL with [http]', async () => {
    const { createServer } = await import('node:http');
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const base = `http://127.0.0.1:${addr.port}`;

    const dir = join(tmpdir(), `natl-with-http-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 't.yaml');
    writeFileSync(
      file,
      `name: With http
engine: mock
vars:
  api_base: ${base}
steps:
  - log: before
  - with: http
    steps:
      - get: $api_base/health
        save: ping
      - assert: $ping.status == 999
  - log: after
`,
    );

    try {
      const factory: AdapterFactory = async () => stubAdapter();
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: { mock: factory },
        logger: () => undefined,
        screenshot: false,
      });
      assert.equal(result.ok, false);
      assert.match(result.error ?? '', /\[http\]/);
      assert.match(result.error ?? '', /assert/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('runs engine: http without UI adapter', async () => {
    const { createServer } = await import('node:http');
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hello: 'natl' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const base = `http://127.0.0.1:${addr.port}`;

    const dir = join(tmpdir(), `natl-http-only-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 't.yaml');
    writeFileSync(
      file,
      `name: Http only
engine: http
vars:
  api_base: ${base}
steps:
  - get: $api_base/
    save: ping
  - assert: $ping.status == 200
`,
    );

    try {
      const result = await runNatlFile({
        file,
        projectConfig: null,
        adapters: {},
        logger: () => undefined,
        screenshot: false,
      });
      assert.equal(result.ok, true, result.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
