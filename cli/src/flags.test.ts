import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFlags, parseShardFlag, selectShardFiles } from './flags.js';

describe('parseFlags', () => {
  it('parses run with reporters, workers, shard, tags', () => {
    const { cmd, positional, flags } = parseFlags([
      'run',
      'tests/',
      '--reporter',
      'console',
      '--reporter',
      'junit',
      '--reporter',
      'allure',
      '--output',
      'artifacts',
      '--workers',
      '2',
      '--shard',
      '1/3',
      '--tags',
      'smoke,auth',
      '--grep',
      'Login',
      '--fail-fast',
      '--max-failures',
      '3',
    ]);
    assert.equal(cmd, 'run');
    assert.deepEqual(positional, ['tests/']);
    assert.deepEqual(flags.reporters, ['console', 'junit', 'allure']);
    assert.equal(flags.output, 'artifacts');
    assert.equal(flags.workers, 2);
    assert.deepEqual(flags.shard, { index: 1, total: 3 });
    assert.equal(flags.tags, 'smoke,auth');
    assert.equal(flags.grep, 'Login');
    assert.equal(flags.failFast, true);
    assert.equal(flags.maxFailures, 3);
    assert.equal(flags.screenshot, true);
  });

  it('rejects invalid workers and unknown reporter', () => {
    assert.throws(() => parseFlags(['run', 't', '--workers', '0']), /workers/);
    assert.throws(() => parseFlags(['run', 't', '--reporter', 'html']), /Unknown reporter/);
    assert.throws(() => parseFlags(['run', 't', '--shard', '0/2']), /index must be between/);
  });

  it('parses init --force and subcommand-less target', () => {
    const init = parseFlags(['init', 'my-app', '--force']);
    assert.equal(init.cmd, 'init');
    assert.deepEqual(init.positional, ['my-app']);
    assert.equal(init.flags.force, true);

    const bare = parseFlags(['login.yaml', '--tags', 'smoke']);
    assert.equal(bare.cmd, 'login.yaml');
    assert.equal(bare.flags.tags, 'smoke');
  });
});

describe('parseShardFlag / selectShardFiles', () => {
  it('parses index/total with spaces', () => {
    assert.deepEqual(parseShardFlag('2 / 4'), { index: 2, total: 4 });
  });

  it('partitions files across shards', () => {
    const files = ['a', 'b', 'c', 'd'];
    assert.deepEqual(selectShardFiles(files, 1, 2), ['a', 'c']);
    assert.deepEqual(selectShardFiles(files, 2, 2), ['b', 'd']);
  });
});
