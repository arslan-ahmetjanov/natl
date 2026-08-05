import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyValidationError,
  isHealableValidationError,
} from './heal.js';
import { buildRepairPrompt, SELECTOR_HINTS } from './prompt.js';
import { formatPrComment } from './publish.js';
import type { GeneratedTest } from './types.js';

describe('heal classification', () => {
  it('classifies schema / parse / step', () => {
    assert.equal(
      classifyValidationError('JSON Schema: /steps must be array'),
      'schema',
    );
    assert.equal(classifyValidationError('Invalid YAML: unexpected end'), 'parse');
    assert.equal(
      classifyValidationError('YAML parse error: unexpected end'),
      'parse',
    );
    assert.equal(
      classifyValidationError('NATL parse error: Unknown step: foo'),
      'step',
    );
    assert.equal(classifyValidationError('network timeout'), 'other');
  });

  it('marks schema/step/parse as healable', () => {
    assert.equal(isHealableValidationError('JSON Schema: x'), true);
    assert.equal(isHealableValidationError('YAML parse error: x'), true);
    assert.equal(isHealableValidationError('NATL parse error: Unknown step bar'), true);
    assert.equal(isHealableValidationError('network timeout'), false);
  });
});

describe('buildRepairPrompt', () => {
  it('includes error, previous YAML, and selector hints', () => {
    const p = buildRepairPrompt({
      previousYaml: 'name: Bad\nsteps: []\n',
      validationError: 'JSON Schema: steps must NOT have fewer than 1 items',
      attempt: 1,
      maxRetries: 2,
      kind: 'schema',
    });
    assert.match(p, /Self-healing repair/);
    assert.match(p, /JSON Schema/);
    assert.match(p, /name: Bad/);
    assert.match(p, /data-testid/);
    assert.ok(SELECTOR_HINTS.includes('data-testid'));
  });
});

describe('formatPrComment healing history', () => {
  it('renders history and healed status', () => {
    const healed: GeneratedTest = {
      yaml: 'name: Ok\nsteps:\n  - log: x\n',
      fileName: 'agent_x.yaml',
      uir: [],
      validationOk: true,
      healed: true,
      healAttempts: [
        { attempt: 0, error: 'JSON Schema: bad', kind: 'schema' },
      ],
    };
    const body = formatPrComment([healed]);
    assert.match(body, /after self-healing/);
    assert.match(body, /Self-healing history/);
    assert.match(body, /attempt 0 \(schema\)/);
  });

  it('renders exhausted retries with final error', () => {
    const failed: GeneratedTest = {
      yaml: 'name: StillBad\n',
      fileName: 'agent_y.yaml',
      uir: [],
      validationOk: false,
      validationError: 'steps must be a non-empty array',
      healAttempts: [
        { attempt: 0, error: 'JSON Schema: a', kind: 'schema' },
        { attempt: 1, error: 'JSON Schema: b', kind: 'schema' },
        { attempt: 2, error: 'steps must be a non-empty array', kind: 'step' },
      ],
    };
    const body = formatPrComment([failed]);
    assert.match(body, /failed validation/);
    assert.match(body, /attempt 2 \(step\)/);
    assert.match(body, /steps must be a non-empty array/);
  });
});
