import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandStepAliases,
  normalizeNatlDocument,
  normalizeNatlYaml,
  splitMultiActionStep,
} from './normalize.js';
import { validateNatlYaml } from './validate.js';

describe('expandStepAliases', () => {
  it('expands fill+with object', () => {
    const { step, fixes } = expandStepAliases({
      'fill+with': { email: 'a@b.c' },
    });
    assert.equal(step.fill, '[data-testid=email]');
    assert.equal(step.with, 'a@b.c');
    assert.ok(fixes.length);
  });

  it('maps submit-button and wait-for-page-to-load', () => {
    const { step } = expandStepAliases({
      'submit-button': 'Submit',
      'wait-for-page-to-load': true,
    });
    assert.match(String(step.click), /Submit|submit/);
    assert.equal(step.wait, 'body');
  });
});

describe('splitMultiActionStep', () => {
  it('splits mega-step from tiny LLM into oneOf-safe steps', () => {
    const { steps, fixes } = splitMultiActionStep({
      goto: 'https://example.com/user',
      fill: '[data-testid=email]',
      with: 'user@example.com',
      click: 'button[type=submit]',
      get: 'https://api.example.com/x',
      save: 'r',
      assert: '$r.status == 200',
      log: 'checkpoint',
    });
    assert.ok(fixes.length);
    assert.ok(steps.length >= 5);
    assert.deepEqual(steps.find((s) => 'fill' in s), {
      fill: '[data-testid=email]',
      with: 'user@example.com',
    });
    assert.deepEqual(steps.find((s) => 'get' in s), {
      get: 'https://api.example.com/x',
      save: 'r',
    });
  });
});

describe('normalizeNatlYaml', () => {
  it('fixes the live 0.5B mega-step document to pass validate', () => {
    const raw = `name: Get user
steps:
  - goto: https://example.com/user
    fill: "[data-testid=email]"
    with: user@example.com
    click: button[type=submit]
    get: https://api.example.com/x
    save: r
    assert: $r.status == 200
    log: checkpoint
`;
    assert.equal(validateNatlYaml(raw).ok, false);
    const { yaml, changed, fixes } = normalizeNatlYaml(raw);
    assert.equal(changed, true);
    assert.ok(fixes.some((f) => /split multi-action/i.test(f)));
    assert.ok(fixes.some((f) => /engine/i.test(f)));
    const gate = validateNatlYaml(yaml);
    assert.equal(gate.ok, true, gate.error);
  });

  it('moves top-level assertions into steps', () => {
    const { doc, changed } = normalizeNatlDocument({
      name: 'A',
      engine: 'http',
      steps: [{ log: 'x' }],
      assertions: ['$r.status == 200'],
    });
    assert.equal(changed, true);
    assert.equal('assertions' in doc, false);
    assert.ok(Array.isArray(doc.steps));
    assert.ok(
      (doc.steps as unknown[]).some(
        (s) => s && typeof s === 'object' && 'assert' in (s as object),
      ),
    );
  });

  it('leaves valid docs unchanged', () => {
    const ok = `name: OK
engine: http
steps:
  - get: https://example.com
    save: r
  - assert: $r.status == 200
`;
    const { changed, yaml } = normalizeNatlYaml(ok);
    assert.equal(changed, false);
    assert.equal(yaml, ok);
    assert.equal(validateNatlYaml(ok).ok, true);
  });
});
