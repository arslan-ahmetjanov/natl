import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateNatlYaml } from './validate.js';

describe('validateNatlYaml', () => {
  it('accepts compact NATL scenario', () => {
    const r = validateNatlYaml(`name: Smoke
engine: http
steps:
  - get: https://example.com
    save: ping
  - assert: $ping.status == 200
`);
    assert.equal(r.ok, true, r.error);
  });

  it('rejects missing steps', () => {
    const r = validateNatlYaml('name: No steps\n');
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /steps/);
  });

  it('rejects invalid step shape via NATL parse', () => {
    const r = validateNatlYaml(`name: Bad
steps:
  - not_a_real_step: true
`);
    assert.equal(r.ok, false);
  });

  it('rejects invalid YAML', () => {
    const r = validateNatlYaml('name: [\n');
    assert.equal(r.ok, false);
  });
});
