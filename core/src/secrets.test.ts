import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { SecretsStore, loadSecretsForFile } from './secrets.js';

describe('SecretsStore', () => {
  it('resolves ${ENV:KEY} and masks values from process env', () => {
    process.env.NATL_SECRETS_MASK = 'super-secret-value';
    try {
      const store = new SecretsStore();
      assert.equal(store.resolveRefs('x=${ENV:NATL_SECRETS_MASK}'), 'x=super-secret-value');
      assert.match(store.mask('leak super-secret-value here'), /leak \*\*\* here/);
    } finally {
      delete process.env.NATL_SECRETS_MASK;
    }
  });

  it('rejects Vault and AWS refs with a clear message', () => {
    const store = new SecretsStore();
    assert.throws(
      () => store.resolveRefs('${VAULT:kv/data/app}'),
      /not built into NATL/,
    );
    assert.throws(
      () => store.resolveRefs('${AWS:my/secret}'),
      /not built into NATL/,
    );
  });

  it('loads .env file and masks quoted values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'natl-secrets-'));
    try {
      const file = join(dir, '.env');
      writeFileSync(file, 'FOO="bar-baz"\n# comment\nEMPTY=\n');
      const store = new SecretsStore();
      store.loadEnvFile(file);
      assert.equal(store.getEnv('FOO'), 'bar-baz');
      assert.equal(store.mask('see bar-baz'), 'see ***');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadSecretsForFile uses secrets.env.file relative to scenario', () => {
    const dir = mkdtempSync(join(tmpdir(), 'natl-secrets-cfg-'));
    try {
      writeFileSync(join(dir, 'creds.env'), 'PILOT_USER=ci-user\n');
      const yamlPath = join(dir, 'login.yaml');
      writeFileSync(yamlPath, 'name: x\n');
      const store = loadSecretsForFile({ env: { file: 'creds.env' } }, yamlPath);
      assert.equal(store.getEnv('PILOT_USER'), 'ci-user');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
