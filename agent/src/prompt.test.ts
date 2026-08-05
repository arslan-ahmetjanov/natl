import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRepairPrompt,
  buildUserPrompt,
  extractJsonObjectFromResponse,
  extractNatlYamlFromResponse,
  extractYamlFromResponse,
  natlJsonToYaml,
  suggestFileName,
  SYSTEM_PROMPT,
} from './prompt.js';
import { validateNatlYaml } from './validate.js';
import type { UirChange } from './types.js';

const sample: UirChange = {
  file: 'src/api/user.py',
  language: 'python',
  changeType: 'FUNCTION_CHANGED',
  entity: 'get_user',
  description: 'changed',
  risk: 'HIGH',
};

describe('prompt', () => {
  it('asks for JSON and canonical step shapes', () => {
    assert.match(SYSTEM_PROMPT, /JSON object/);
    assert.match(SYSTEM_PROMPT, /"fill"/);
    assert.doesNotMatch(SYSTEM_PROMPT, /Prefer compact NATL steps:.*fill\+with/);
  });

  it('embeds UIR JSON, examples, and locator guidance', () => {
    const prompt = buildUserPrompt({
      changes: [sample],
      examples: [
        {
          path: 'examples/login.yaml',
          content: 'name: Login\nsteps:\n  - goto: /\n',
          score: 3,
        },
      ],
    });
    assert.match(prompt, /get_user/);
    assert.match(prompt, /examples\/login\.yaml/);
    assert.match(prompt, /name: Login/);
    assert.match(prompt, /data-testid/);
    assert.match(prompt, /JSON object/);
  });

  it('repair prompt asks for JSON fix', () => {
    const p = buildRepairPrompt({
      previousYaml: 'name: X\nsteps: []\n',
      validationError: 'Missing steps',
      attempt: 1,
      maxRetries: 2,
      kind: 'schema',
    });
    assert.match(p, /JSON object/);
    assert.match(p, /Missing steps/);
  });

  it('strips markdown fences from YAML', () => {
    const yaml = extractYamlFromResponse('```yaml\nname: X\nsteps: []\n```');
    assert.equal(yaml, 'name: X\nsteps: []');
  });

  it('parses JSON object from fences and raw', () => {
    const doc = extractJsonObjectFromResponse(
      '```json\n{"name":"T","engine":"http","steps":[{"log":"hi"}]}\n```',
    );
    assert.equal(doc?.name, 'T');
    assert.ok(Array.isArray(doc?.steps));

    const raw = extractJsonObjectFromResponse(
      '{"name":"R","steps":[{"get":"https://x","save":"r"}]}',
    );
    assert.equal(raw?.name, 'R');
  });

  it('JSON→YAML produces gate-valid document', () => {
    const yaml = extractNatlYamlFromResponse(
      JSON.stringify({
        name: 'Agent get_user',
        engine: 'http',
        steps: [
          { get: 'https://example.com/user', save: 'u' },
          { assert: '$u.status == 200' },
        ],
      }),
    );
    assert.match(yaml, /name: Agent get_user/);
    assert.match(yaml, /engine: http/);
    assert.equal(validateNatlYaml(yaml).ok, true, validateNatlYaml(yaml).error);
  });

  it('falls back to YAML when response is not JSON', () => {
    const yaml = extractNatlYamlFromResponse(`name: Legacy
engine: http
steps:
  - log: hi
`);
    assert.match(yaml, /name: Legacy/);
    assert.equal(validateNatlYaml(yaml).ok, true);
  });

  it('natlJsonToYaml is stable for nested steps', () => {
    const y = natlJsonToYaml({
      name: 'Fill',
      engine: 'playwright',
      steps: [{ fill: '[data-testid=email]', with: 'a@b.c' }, { click: 'button' }],
    });
    assert.match(y, /fill:/);
    assert.match(y, /with:/);
    assert.equal(validateNatlYaml(y).ok, true, validateNatlYaml(y).error);
  });

  it('suggests safe file names', () => {
    assert.equal(suggestFileName([sample]), 'agent_get_user.yaml');
  });
});
