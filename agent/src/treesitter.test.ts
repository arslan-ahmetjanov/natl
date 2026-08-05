import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractEntitiesTreeSitter, extractImportHints } from './treesitter.js';
import { analyzeSemanticDiffAsync } from './semantic.js';
import type { DiffFile } from './types.js';

describe('extractEntitiesTreeSitter', () => {
  it('extracts python function and class', async () => {
    const src = `
class User:
    pass

async def get_user(timeout=None):
    return {}
`;
    const ents = await extractEntitiesTreeSitter(src, 'python');
    assert.ok(ents, 'tree-sitter should load');
    const names = new Set(ents!.map((e) => e.name));
    assert.ok(names.has('get_user'));
    assert.ok(names.has('User'));
  });

  it('extracts typescript function', async () => {
    const src = `
export async function login(user: string, timeout: number) {
  return true;
}
`;
    const ents = await extractEntitiesTreeSitter(src, 'typescript');
    assert.ok(ents);
    assert.ok(ents!.some((e) => e.name === 'login'));
  });

  it('extracts go function', async () => {
    const src = `
package main
func GetUser(timeout int) error {
  return nil
}
`;
    const ents = await extractEntitiesTreeSitter(src, 'go');
    assert.ok(ents);
    assert.ok(ents!.some((e) => e.name === 'GetUser'));
  });

  it('extracts java method', async () => {
    const src = `
public class Api {
  public User getUser(int timeout) {
    return null;
  }
}
`;
    const ents = await extractEntitiesTreeSitter(src, 'java');
    assert.ok(ents);
    assert.ok(ents!.some((e) => e.name === 'getUser' || e.name === 'Api'));
  });

  it('extracts csharp method', async () => {
    const src = `
public class Api {
  public User GetUser(int timeout) {
    return null;
  }
}
`;
    const ents = await extractEntitiesTreeSitter(src, 'csharp');
    assert.ok(ents);
    assert.ok(ents!.some((e) => e.name === 'GetUser' || e.name === 'Api'));
  });
});

describe('analyzeSemanticDiffAsync', () => {
  it('detects FUNCTION_CHANGED via tree-sitter path', async () => {
    const files: DiffFile[] = [
      {
        path: 'src/login.ts',
        status: 'modified',
        patch: [
          'diff --git a/src/login.ts b/src/login.ts',
          '--- a/src/login.ts',
          '+++ b/src/login.ts',
          '@@ -1,3 +1,3 @@',
          '-export function login(user: string) {',
          '+export async function login(user: string, timeout: number) {',
          '   return true',
          ' }',
        ].join('\n'),
      },
    ];
    const uir = await analyzeSemanticDiffAsync(files);
    const hit = uir.find((c) => c.entity === 'login');
    assert.ok(hit);
    assert.equal(hit!.changeType, 'FUNCTION_CHANGED');
  });
});

describe('extractImportHints', () => {
  it('finds relative imports', () => {
    const hints = extractImportHints(`
import { x } from './util';
const y = require('../lib/a');
`);
    assert.ok(hints.includes('./util'));
    assert.ok(hints.includes('../lib/a'));
  });
});
