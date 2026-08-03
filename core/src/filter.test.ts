import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNatlFiles,
  matchesGrep,
  matchesTags,
  parseTagsCsv,
} from './filter.js';
import type { NatFileMeta } from './types.js';

function doc(partial: Partial<NatFileMeta> & { steps?: NatFileMeta['steps'] }): NatFileMeta {
  return { steps: [], ...partial };
}

describe('parseTagsCsv', () => {
  it('splits and trims', () => {
    assert.deepEqual(parseTagsCsv('smoke, auth ,ci'), ['smoke', 'auth', 'ci']);
  });

  it('returns empty for blank', () => {
    assert.deepEqual(parseTagsCsv(undefined), []);
    assert.deepEqual(parseTagsCsv('  '), []);
  });
});

describe('matchesTags', () => {
  it('OR: any listed tag', () => {
    const d = doc({ tags: ['smoke', 'auth'] });
    assert.equal(matchesTags(d, ['smoke']), true);
    assert.equal(matchesTags(d, ['auth', 'ci']), true);
    assert.equal(matchesTags(d, ['ci']), false);
  });

  it('empty required always matches', () => {
    assert.equal(matchesTags(doc({}), []), true);
  });
});

describe('matchesGrep', () => {
  it('matches name or path', () => {
    const d = doc({ name: 'Login smoke' });
    assert.equal(matchesGrep(d, '/tests/other.yaml', /Login/), true);
    assert.equal(matchesGrep(d, '/tests/login.yaml', /login\.yaml/), true);
    assert.equal(matchesGrep(d, '/tests/other.yaml', /Checkout/), false);
  });
});

describe('filterNatlFiles', () => {
  const files = [
    '/suite/a.yaml',
    '/suite/b.yaml',
    '/suite/c.yaml',
  ];
  const docs = new Map<string, NatFileMeta>([
    [files[0], doc({ name: 'Login smoke', tags: ['smoke', 'auth'] })],
    [files[1], doc({ name: 'Checkout flow', tags: ['regression'] })],
    [files[2], doc({ name: 'API health', tags: ['smoke'] })],
  ]);

  it('--tags smoke keeps only tagged', () => {
    const r = filterNatlFiles({ files, docs, tags: ['smoke'] });
    assert.deepEqual(r.files, [files[0], files[2]]);
  });

  it('--grep by name', () => {
    const r = filterNatlFiles({ files, docs, grep: 'Login' });
    assert.deepEqual(r.files, [files[0]]);
  });

  it('tags and grep combine (AND between filters)', () => {
    const r = filterNatlFiles({ files, docs, tags: ['smoke'], grep: 'API' });
    assert.deepEqual(r.files, [files[2]]);
  });

  it('empty filter returns clear reason', () => {
    const r = filterNatlFiles({ files, docs, tags: ['missing'] });
    assert.deepEqual(r.files, []);
    assert.match(r.emptyReason ?? '', /No tests matched/);
    assert.match(r.emptyReason ?? '', /3 file\(s\) scanned/);
  });

  it('invalid grep throws', () => {
    assert.throws(
      () => filterNatlFiles({ files, docs, grep: '(' }),
      /Invalid --grep/,
    );
  });
});
