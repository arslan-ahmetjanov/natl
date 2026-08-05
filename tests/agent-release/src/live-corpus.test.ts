import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff, analyzeSemanticDiff } from '@natl/agent';
import {
  buildLiveCorpus,
  LIVE_CORPUS_DEFAULT_N,
} from './live-corpus.js';

describe('live corpus', () => {
  it('builds default N sanitized diffs without PII', () => {
    const corpus = buildLiveCorpus(LIVE_CORPUS_DEFAULT_N);
    assert.equal(corpus.length, 50);
    const blob = corpus.map((c) => c.diff).join('\n');
    assert.doesNotMatch(blob, /sk-[a-zA-Z0-9]{10,}/);
    assert.doesNotMatch(blob, /api[_-]?key\s*=\s*['\"][^'\"]+['\"]/i);
    assert.doesNotMatch(blob, /@gmail\.com|@company\.com/i);
    for (const c of corpus) {
      assert.ok(c.diff.includes('diff --git'));
      assert.ok(c.entity.length > 0);
      const files = parseUnifiedDiff(c.diff);
      assert.equal(files.length, 1);
      const uir = analyzeSemanticDiff(files);
      assert.ok(uir.length >= 1, `no UIR for case ${c.id} ${c.path}`);
    }
  });

  it('respects LIVE_EVAL_N bounds', () => {
    assert.equal(buildLiveCorpus(3).length, 3);
    assert.equal(buildLiveCorpus(200).length, 200);
  });
});
