import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAgentConfig, runAgent } from '@natl/agent';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const force = process.env.LOCAL_LLM === '1';

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch('http://127.0.0.1:8787/health', {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

describe('release: live local-llm', () => {
  it('generates YAML via tiny Transformers.js server', async (t) => {
    const up = await healthOk();
    if (!up) {
      if (force) {
        assert.fail('LOCAL_LLM=1 but http://127.0.0.1:8787/health is down — run local-llm');
      }
      t.skip('local-llm not running (start: cd local-llm && npm start)');
      return;
    }

    const { spawnSync } = await import('node:child_process');
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join: j } = await import('node:path');

    const repo = mkdtempSync(j(tmpdir(), 'natl-live-'));
    const git = (args: string[]) =>
      spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    git(['init']);
    git(['config', 'user.email', 'test@natl.dev']);
    git(['config', 'user.name', 'NATL']);
    writeFileSync(j(repo, 'app.py'), 'def ping():\n    return 1\n', 'utf8');
    git(['add', '-A']);
    git(['commit', '-m', 'base']);
    writeFileSync(
      j(repo, 'app.py'),
      'def ping():\n    return 1\n\ndef get_user(timeout=None):\n    return {}\n',
      'utf8',
    );
    git(['add', '-A']);
    git(['commit', '-m', 'feat']);
    mkdirSync(j(repo, 'fixtures'));
    writeFileSync(
      j(repo, 'fixtures', 'sample.yaml'),
      'name: Sample get_user\nengine: http\nsteps:\n  - log: hi\n',
      'utf8',
    );

    const config = loadAgentConfig({
      cwd: repo,
      configPath: join(root, 'natl-agent.local.yml'),
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'stdout',
        testRoots: ['fixtures'],
      },
    });

    const result = await runAgent({ config });
    assert.ok(result.tests.length >= 1, result.message);
    // Tiny model may fail validate — still assert we got a non-empty attempt
    assert.ok(result.tests[0]!.yaml.trim().length > 0);
    console.log(
      '[live] validationOk=',
      result.tests[0]!.validationOk,
      result.tests[0]!.validationError ?? '',
    );
  });
});
