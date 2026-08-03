import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeStep, parseNatlDocument, parseNatlFile } from './parser.js';
import { preprocessNatlSource } from './preprocess.js';
import { ExpressionEngine, evaluateExpression } from './expr.js';
import { formatStepFail } from './step-format.js';
import { SecretsStore } from './secrets.js';

describe('preprocessNatlSource', () => {
  it('expands fill with compact form', () => {
    const out = preprocessNatlSource('- fill: "#email" with: $user\n');
    assert.match(out, /fill: "#email"/);
    assert.match(out, /with: \$user/);
  });

  it('expands assert text', () => {
    const out = preprocessNatlSource('- assert: ".welcome" text: "Hello"\n');
    assert.match(out, /assert: "\.welcome"/);
    assert.match(out, /text: "Hello"/);
  });

  it('expands wait visible', () => {
    const out = preprocessNatlSource('- wait: ".dashboard" visible\n');
    assert.match(out, /wait: "\.dashboard visible"/);
  });

  it('expands assert visible flag', () => {
    const out = preprocessNatlSource('- assert: ".error" visible\n');
    assert.match(out, /assert: "\.error"/);
    assert.match(out, /visible: true/);
  });

  it('expands soft_assert visible flag', () => {
    const out = preprocessNatlSource('- soft_assert: ".error" visible\n');
    assert.match(out, /soft_assert: "\.error"/);
    assert.match(out, /visible: true/);
  });

  it('expands soft_assert text', () => {
    const out = preprocessNatlSource('- soft_assert: ".price" text: "$10"\n');
    assert.match(out, /soft_assert: "\.price"/);
    assert.match(out, /text: "\$10"/);
  });

  it('expands scroll into_view sugar', () => {
    const out = preprocessNatlSource('- scroll: $footer into_view\n');
    assert.match(out, /scroll:\s*\$footer/);
    assert.match(out, /into_view:\s*true/);
  });

  it('expands swipe direction sugar', () => {
    const out = preprocessNatlSource('- swipe: $carousel direction: left\n');
    assert.match(out, /swipe:\s*\$carousel/);
    assert.match(out, /direction:\s*left/);
  });

  it('leaves expression asserts alone', () => {
    const src = '- assert: current_url == "/dashboard"\n';
    assert.equal(preprocessNatlSource(src).trim(), src.trim());
  });
});

describe('normalizeStep', () => {
  it('parses click shorthand', () => {
    const step = normalizeStep({ click: '#login-btn' });
    assert.equal(step.type, 'click');
    if (step.type === 'click') assert.equal(step.locator, '#login-btn');
  });

  it('parses tap as click alias', () => {
    const step = normalizeStep({ tap: '#login-btn' });
    assert.equal(step.type, 'click');
    if (step.type === 'click') assert.equal(step.locator, '#login-btn');
  });

  it('parses scroll into_view', () => {
    const step = normalizeStep({ scroll: '#footer', into_view: true });
    assert.equal(step.type, 'scroll');
    if (step.type === 'scroll') {
      assert.equal(step.locator, '#footer');
      assert.equal(step.intoView, true);
    }
  });

  it('parses scroll string with into_view suffix', () => {
    const step = normalizeStep({ scroll: '$footer into_view' });
    assert.equal(step.type, 'scroll');
    if (step.type === 'scroll') {
      assert.equal(step.locator, '$footer');
      assert.equal(step.intoView, true);
    }
  });

  it('parses swipe with direction', () => {
    const step = normalizeStep({ swipe: '#carousel', direction: 'left', distance: 80 });
    assert.equal(step.type, 'swipe');
    if (step.type === 'swipe') {
      assert.equal(step.locator, '#carousel');
      assert.equal(step.direction, 'left');
      assert.equal(step.distance, 80);
    }
  });

  it('parses long_press with duration_ms', () => {
    const step = normalizeStep({ long_press: '#card', duration_ms: 700 });
    assert.equal(step.type, 'long_press');
    if (step.type === 'long_press') {
      assert.equal(step.locator, '#card');
      assert.equal(step.durationMs, 700);
    }
  });

  it('parses with: http block', () => {
    const step = normalizeStep({
      with: 'http',
      steps: [{ get: 'https://example.com/health', save: 'h' }],
    });
    assert.equal(step.type, 'with');
    if (step.type === 'with') {
      assert.equal(step.engine, 'http');
      assert.equal(step.steps.length, 1);
      assert.equal(step.steps[0]!.type, 'api');
      if (step.steps[0]!.type === 'api') {
        assert.equal(step.steps[0].method, 'GET');
        assert.equal(step.steps[0].url, 'https://example.com/health');
      }
    }
  });

  it('parses get/post as api steps', () => {
    const g = normalizeStep({ get: '/health', save: 'h' });
    assert.equal(g.type, 'api');
    if (g.type === 'api') {
      assert.equal(g.method, 'GET');
      assert.equal(g.url, '/health');
      assert.equal(g.save, 'h');
    }
    const p = normalizeStep({ post: '/login', body: { a: 1 }, save: 'r' });
    assert.equal(p.type, 'api');
    if (p.type === 'api') {
      assert.equal(p.method, 'POST');
      assert.deepEqual(p.body, { a: 1 });
    }
  });

  it('parses fill with', () => {
    const step = normalizeStep({ fill: '#email', with: '$user' });
    assert.equal(step.type, 'fill');
    if (step.type === 'fill') {
      assert.equal(step.locator, '#email');
      assert.equal(step.with, '$user');
    }
  });

  it('parses wait visible', () => {
    const step = normalizeStep({ wait: '.dashboard visible' });
    assert.equal(step.type, 'wait');
    if (step.type === 'wait') {
      assert.equal(step.selector, '.dashboard');
      assert.equal(step.state, 'visible');
    }
  });

  it('parses wait ms', () => {
    const step = normalizeStep({ wait: '2000 ms' });
    assert.equal(step.type, 'wait');
    if (step.type === 'wait') assert.equal(step.ms, 2000);
  });

  it('parses assert text', () => {
    const step = normalizeStep({ assert: '.welcome', text: 'Hello' });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'text');
      assert.equal(step.locator, '.welcome');
      assert.equal(step.expected, 'Hello');
    }
  });

  it('parses assert visible', () => {
    const step = normalizeStep({ assert: '.error', visible: true });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'visible');
      assert.equal(step.locator, '.error');
    }
  });

  it('parses soft_assert', () => {
    const step = normalizeStep({ soft_assert: '.price', text: '$10' });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'text');
      assert.equal(step.locator, '.price');
      assert.equal(step.expected, '$10');
      assert.equal(step.soft, true);
    }
  });

  it('parses assert contains sibling', () => {
    const step = normalizeStep({ assert: '.welcome', contains: 'Hell' });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'contains');
      assert.equal(step.locator, '.welcome');
      assert.equal(step.expected, 'Hell');
    }
  });

  it('parses assert is: as text alias', () => {
    const step = normalizeStep({ assert: '.welcome', is: 'Hello' });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'text');
      assert.equal(step.expected, 'Hello');
    }
  });

  it('parses $el visible as visibility assert', () => {
    const step = normalizeStep({ assert: '$welcome visible' });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'visible');
      assert.equal(step.locator, '$welcome');
    }
  });

  it('parses assert with soft: true', () => {
    const step = normalizeStep({ assert: '.stock', visible: true, soft: true });
    assert.equal(step.type, 'assert');
    if (step.type === 'assert') {
      assert.equal(step.kind, 'visible');
      assert.equal(step.soft, true);
    }
  });

  it('parses if/then/else', () => {
    const step = normalizeStep({
      if: '$x == 1',
      then: [{ log: 'yes' }],
      else: [{ log: 'no' }],
    });
    assert.equal(step.type, 'if');
    if (step.type === 'if') {
      assert.equal(step.condition, '$x == 1');
      assert.equal(step.then.length, 1);
      assert.equal(step.else?.length, 1);
    }
  });

  it('parses for loop', () => {
    const step = normalizeStep({
      for: '$item in ["a", "b"]',
      steps: [{ log: '$item' }],
    });
    assert.equal(step.type, 'for');
    if (step.type === 'for') {
      assert.equal(step.variable, 'item');
      assert.equal(step.iterable, '["a", "b"]');
    }
  });

  it('parses set expression', () => {
    const step = normalizeStep({ set: '$total = $price * $quantity' });
    assert.equal(step.type, 'set');
    if (step.type === 'set') {
      assert.equal(step.expression, '$total = $price * $quantity');
    }
  });

  it('parses api object', () => {
    const step = normalizeStep({
      api: { method: 'POST', url: '/cart', body: { id: 1 } },
      save: 'cart_response',
    });
    assert.equal(step.type, 'api');
    if (step.type === 'api') {
      assert.equal(step.method, 'POST');
      assert.equal(step.url, '/cart');
      assert.equal(step.save, 'cart_response');
    }
  });

  it('parses do page.action with sibling args', () => {
    const step = normalizeStep({
      do: 'login.login',
      user: '$test_user',
      pass: '$test_pass',
    });
    assert.equal(step.type, 'do');
    if (step.type === 'do') {
      assert.equal(step.target, 'login.login');
      assert.deepEqual(step.vars, { user: '$test_user', pass: '$test_pass' });
    }
  });

  it('parses do with vars bag merged with siblings', () => {
    const step = normalizeStep({
      do: 'login',
      vars: { user: 'a' },
      pass: 'b',
    });
    assert.equal(step.type, 'do');
    if (step.type === 'do') {
      assert.equal(step.target, 'login');
      assert.deepEqual(step.vars, { user: 'a', pass: 'b' });
    }
  });

  it('still parses include page/action with vars', () => {
    const step = normalizeStep({
      include: 'login/login',
      vars: { user: '$u', pass: '$p' },
    });
    assert.equal(step.type, 'include');
    if (step.type === 'include') {
      assert.equal(step.file, 'login');
      assert.equal(step.action, 'login');
      assert.deepEqual(step.vars, { user: '$u', pass: '$p' });
    }
  });
});

describe('parseNatlDocument', () => {
  it('parses a minimal test', () => {
    const doc = parseNatlDocument({
      name: 'Login',
      engine: 'playwright',
      vars: { base_url: 'https://example.com' },
      steps: [{ goto: '$base_url' }, { assert: 'current_url contains example' }],
    });
    assert.equal(doc.name, 'Login');
    assert.equal(doc.steps.length, 2);
  });

  it('parses tags on the root', () => {
    const doc = parseNatlDocument({
      name: 'Login smoke',
      tags: ['smoke', 'auth'],
      steps: [{ log: 'ok' }],
    });
    assert.deepEqual(doc.tags, ['smoke', 'auth']);
  });
});

describe('parseNatlFile compact syntax', () => {
  it('parses compact NATL YAML from disk', () => {
    const dir = join(tmpdir(), `natl-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 't.yaml');
    writeFileSync(
      file,
      `name: T
steps:
  - fill: "#email" with: $user
  - wait: ".dashboard" visible
  - assert: ".welcome" text: "Hi"
`,
      'utf-8',
    );
    try {
      const doc = parseNatlFile(file);
      assert.equal(doc.steps.length, 3);
      assert.equal(doc.steps[0].type, 'fill');
      assert.equal(doc.steps[1].type, 'wait');
      assert.equal(doc.steps[2].type, 'assert');
      assert.equal(doc.steps[0].line, 3);
      assert.equal(doc.steps[1].line, 4);
      assert.equal(doc.steps[2].line, 5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('formatStepFail', () => {
  it('formats FAIL with file, line, and short step', () => {
    const msg = formatStepFail(
      'examples/login.yaml',
      { type: 'click', locator: '#login-btn', line: 14 },
      'Timeout 5000ms exceeded',
    );
    assert.equal(msg, 'FAIL examples/login.yaml:14 click "#login-btn" — Timeout 5000ms exceeded');
  });

  it('formats assert short description', () => {
    const msg = formatStepFail(
      't.yaml',
      { type: 'assert', kind: 'text', locator: '.welcome', line: 16 },
      'assert text failed: expected "x", got "y"',
    );
    assert.match(msg, /FAIL t\.yaml:16 assert text "\.welcome" —/);
  });
});

describe('ExpressionEngine', () => {
  it('evaluates arithmetic and set', () => {
    const eng = new ExpressionEngine({ price: 10, quantity: 3 });
    eng.executeSet('$total = $price * $quantity');
    assert.equal(eng.get('total'), 30);
  });

  it('interpolates variables', () => {
    const eng = new ExpressionEngine({ user: 'Alice' });
    assert.equal(eng.interpolate('Hello, $user'), 'Hello, Alice');
  });

  it('evaluates conditions with and/or', () => {
    assert.equal(evaluateExpression('1 > 0 and 2 == 2', {}), true);
    assert.equal(evaluateExpression('1 > 0 and 2 == 3', {}), false);
    assert.equal(evaluateExpression('false or true', {}), true);
  });

  it('supports contains and matches', () => {
    assert.equal(evaluateExpression('"hello world" contains "world"', {}), true);
    assert.equal(evaluateExpression('match("a@b.com", "^.+@.+$")', {}), true);
  });

  it('supports builtins', () => {
    assert.equal(evaluateExpression('len("abc")', {}), 3);
    assert.equal(evaluateExpression('upper("hi")', {}), 'HI');
    assert.equal(evaluateExpression('join(["a","b"], ",")', {}), 'a,b');
    const range = evaluateExpression('range(1, 3)', {});
    assert.deepEqual(range, [1, 2, 3]);
  });

  it('supports nested field access', () => {
    const eng = new ExpressionEngine({
      user: { email: 'a@b.com', role: 'admin' },
    });
    assert.equal(eng.evaluate('$user.role == "admin"'), true);
    assert.equal(eng.interpolate('$user.email'), 'a@b.com');
  });

  it('resolves $env.* and $secret.*', () => {
    const secrets = new SecretsStore();
    process.env.NATL_TEST_ENV_USER = 'env-user@test.com';
    process.env.NATL_TEST_SECRET = 's3cret';
    const eng = new ExpressionEngine({}, secrets);
    assert.equal(eng.interpolate('u=$env.NATL_TEST_ENV_USER'), 'u=env-user@test.com');
    assert.equal(eng.interpolate('p=$secret.NATL_TEST_SECRET'), 'p=s3cret');
    assert.equal(eng.evaluate('$env.NATL_TEST_ENV_USER == "env-user@test.com"'), true);
    assert.match(secrets.mask('leak s3cret here'), /leak \*\*\* here/);
  });

  it('keeps ${ENV:KEY} compat', () => {
    const secrets = new SecretsStore();
    process.env.NATL_TEST_COMPAT = 'compat-ok';
    const eng = new ExpressionEngine({}, secrets);
    assert.equal(eng.interpolate('x=${ENV:NATL_TEST_COMPAT}'), 'x=compat-ok');
  });
});
