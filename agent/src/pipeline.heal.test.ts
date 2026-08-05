import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadAgentConfig } from './config.js';
import { runAgent } from './pipeline.js';
import { validateNatlYaml } from './validate.js';

const INVALID_YAML = `name: Bad get_user
steps:
  - not_a_real_step: true
`;

const VALID_YAML = `name: Agent get_user
engine: http
steps:
  - get: https://example.com/user
    save: u
  - assert: $u.status == 200
`;

function initRepoWithChange(): string {
  const repo = mkdtempSync(join(tmpdir(), 'natl-agent-heal-'));
  mkdirSync(join(repo, 'fixtures'));
  writeFileSync(
    join(repo, 'fixtures', 'demo.yaml'),
    'name: Demo get_user\nsteps:\n  - log: x\n',
    'utf8',
  );
  writeFileSync(
    join(repo, 'natl-agent.yml'),
    [
      'llm:',
      '  provider: custom',
      '  endpoint: http://127.0.0.1:9/v1',
      '  model: stub',
      'mode: stdout',
      'test_roots: [fixtures]',
      'self_healing:',
      '  enabled: true',
      '  max_retries: 2',
    ].join('\n'),
    'utf8',
  );

  const git = (args: string[]) =>
    spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  git(['init']);
  git(['config', 'user.email', 'test@natl.dev']);
  git(['config', 'user.name', 'NATL Test']);
  writeFileSync(join(repo, 'src_user.py'), 'def existing():\n    pass\n', 'utf8');
  git(['add', '-A']);
  git(['commit', '-m', 'base']);
  writeFileSync(
    join(repo, 'src_user.py'),
    'def existing():\n    pass\n\nasync def get_user(timeout=None):\n    return {}\n',
    'utf8',
  );
  git(['add', '-A']);
  git(['commit', '-m', 'change']);
  return repo;
}

describe('self-healing pipeline', () => {
  it('heals invalid YAML on first repair (schema/step class)', async () => {
    const repo = initRepoWithChange();
    const config = loadAgentConfig({
      cwd: repo,
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'stdout',
        testRoots: ['fixtures'],
        selfHealing: { enabled: true, maxRetries: 2 },
      },
    });

    let calls = 0;
    const result = await runAgent({
      config,
      llmOverride: async (_prompt, meta) => {
        calls += 1;
        if (!meta || meta.attempt === 0) return INVALID_YAML;
        assert.ok(meta.validationError);
        assert.equal(meta.attempt, 1);
        return VALID_YAML;
      },
    });

    assert.equal(calls, 2);
    assert.equal(result.tests[0]!.validationOk, true, result.tests[0]!.validationError);
    assert.equal(result.tests[0]!.healed, true);
    assert.ok(result.tests[0]!.healAttempts?.length);
    assert.match(result.message, /self-healing/i);
    assert.equal(validateNatlYaml(result.tests[0]!.yaml).ok, true);
  });

  it('stops after max_retries and keeps gate fail + history', async () => {
    const repo = initRepoWithChange();
    const config = loadAgentConfig({
      cwd: repo,
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'stdout',
        testRoots: ['fixtures'],
        selfHealing: { enabled: true, maxRetries: 2 },
      },
    });

    let calls = 0;
    const result = await runAgent({
      config,
      llmOverride: async () => {
        calls += 1;
        return INVALID_YAML;
      },
    });

    assert.equal(calls, 3); // initial + 2 repairs
    assert.equal(result.tests[0]!.validationOk, false);
    assert.equal(result.tests[0]!.healed, undefined);
    assert.ok((result.tests[0]!.healAttempts?.length ?? 0) >= 2);
    assert.match(result.message, /Self-healing history/);
    assert.match(result.message, /failed validation/);
  });

  it('does not repair when self_healing disabled', async () => {
    const repo = initRepoWithChange();
    const config = loadAgentConfig({
      cwd: repo,
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'stdout',
        testRoots: ['fixtures'],
        selfHealing: { enabled: false, maxRetries: 2 },
      },
    });

    let calls = 0;
    const result = await runAgent({
      config,
      llmOverride: async () => {
        calls += 1;
        return INVALID_YAML;
      },
    });

    assert.equal(calls, 1);
    assert.equal(result.tests[0]!.validationOk, false);
    assert.equal(result.tests[0]!.healed, undefined);
  });

  it('never commits invalid YAML even after exhausted healing', async () => {
    const repo = initRepoWithChange();
    const outRoot = 'out_tests';
    mkdirSync(join(repo, outRoot));
    const config = loadAgentConfig({
      cwd: repo,
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'commit',
        testRoots: [outRoot],
        selfHealing: { enabled: true, maxRetries: 1 },
      },
    });

    await runAgent({
      config,
      llmOverride: async () => INVALID_YAML,
    });

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(join(repo, outRoot));
    assert.equal(files.length, 0, `unexpected commit write: ${files.join(',')}`);
  });
});
