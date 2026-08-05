import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSemanticDiff, detectLanguage, splitPatchBodies } from './semantic.js';
import type { DiffFile } from './types.js';

describe('detectLanguage', () => {
  it('maps common extensions', () => {
    assert.equal(detectLanguage('a.py'), 'python');
    assert.equal(detectLanguage('a.ts'), 'typescript');
    assert.equal(detectLanguage('a.go'), 'go');
    assert.equal(detectLanguage('a.cs'), 'csharp');
    assert.equal(detectLanguage('a.java'), 'java');
    assert.equal(detectLanguage('a.txt'), 'unknown');
  });
});

describe('analyzeSemanticDiff', () => {
  it('detects added python function', () => {
    const files: DiffFile[] = [
      {
        path: 'src/api/user.py',
        status: 'modified',
        patch: [
          'diff --git a/src/api/user.py b/src/api/user.py',
          '--- a/src/api/user.py',
          '+++ b/src/api/user.py',
          '@@ -1,3 +1,6 @@',
          ' def existing():',
          '     pass',
          '+',
          '+async def get_user(timeout=None):',
          '+    return {}',
        ].join('\n'),
      },
    ];
    const uir = analyzeSemanticDiff(files);
    const hit = uir.find((c) => c.entity === 'get_user');
    assert.ok(hit);
    assert.equal(hit!.changeType, 'FUNCTION_ADDED');
    assert.equal(hit!.language, 'python');
    assert.equal(hit!.risk, 'MEDIUM');
  });

  it('detects typescript function signature change', () => {
    const files: DiffFile[] = [
      {
        path: 'src/login.ts',
        status: 'modified',
        patch: [
          'diff --git a/src/login.ts b/src/login.ts',
          '--- a/src/login.ts',
          '+++ b/src/login.ts',
          '@@ -1,2 +1,2 @@',
          '-export function login(user: string) {',
          '+export async function login(user: string, timeout: number) {',
          '   return true',
        ].join('\n'),
      },
    ];
    const uir = analyzeSemanticDiff(files);
    const hit = uir.find((c) => c.entity === 'login');
    assert.ok(hit);
    assert.equal(hit!.changeType, 'FUNCTION_CHANGED');
    assert.equal(hit!.risk, 'HIGH');
  });
});

describe('splitPatchBodies', () => {
  it('reconstructs old and new sides', () => {
    const { oldBody, newBody } = splitPatchBodies(
      ['--- a/x', '+++ b/x', '@@', ' same', '-old', '+new'].join('\n'),
    );
    assert.match(oldBody, /same/);
    assert.match(oldBody, /old/);
    assert.match(newBody, /new/);
    assert.doesNotMatch(newBody, /^old$/m);
  });
});
