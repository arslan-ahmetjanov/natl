import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildContext } from './context.js';
import type { UirChange } from './types.js';

describe('buildContext', () => {
  it('scores YAML that mention the entity', () => {
    const root = mkdtempSync(join(tmpdir(), 'natl-agent-ctx-'));
    const tests = join(root, 'tests');
    mkdirSync(tests);
    writeFileSync(
      join(tests, 'login.yaml'),
      'name: Login get_user flow\nsteps:\n  - goto: /\n  - assert: "#ok"\n    visible: true\n',
      'utf8',
    );
    writeFileSync(
      join(tests, 'other.yaml'),
      'name: Other\nsteps:\n  - goto: /other\n',
      'utf8',
    );

    const changes: UirChange[] = [
      {
        file: 'a.py',
        language: 'python',
        changeType: 'FUNCTION_CHANGED',
        entity: 'get_user',
        description: 'x',
        risk: 'HIGH',
      },
    ];

    const ctx = buildContext({
      cwd: root,
      roots: ['tests'],
      changes,
      maxExamples: 2,
    });
    assert.ok(ctx.length >= 1);
    assert.equal(ctx[0]!.path, 'tests/login.yaml');
  });
});
