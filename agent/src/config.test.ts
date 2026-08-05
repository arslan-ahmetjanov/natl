import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildLlmConfig,
  expandEnv,
  loadAgentConfig,
  parseAgentFile,
} from './config.js';

describe('expandEnv', () => {
  it('expands ${VAR} and $VAR', () => {
    process.env.NATL_TEST_KEY = 'secret';
    assert.equal(expandEnv('${NATL_TEST_KEY}'), 'secret');
    assert.equal(expandEnv('pre-$NATL_TEST_KEY-post'), 'pre-secret-post');
    delete process.env.NATL_TEST_KEY;
  });
});

describe('buildLlmConfig', () => {
  it('defaults openai endpoint and forces temperature 0', () => {
    const llm = buildLlmConfig({
      provider: 'openai',
      parameters: { temperature: 0.7, max_tokens: 100 },
    });
    assert.equal(llm.provider, 'openai');
    assert.equal(llm.endpoint, 'https://api.openai.com/v1');
    assert.equal(llm.parameters.temperature, 0);
    assert.equal(llm.parameters.maxTokens, 100);
  });

  it('defaults ollama local endpoint', () => {
    const llm = buildLlmConfig({ provider: 'ollama' });
    assert.equal(llm.endpoint, 'http://localhost:11434/v1');
    assert.equal(llm.model, 'llama3.2');
  });

  it('enables jsonMode for openai/azure; disables for ollama', () => {
    assert.equal(buildLlmConfig({ provider: 'openai' }).jsonMode, true);
    assert.equal(buildLlmConfig({ provider: 'azure', endpoint: 'https://x' }).jsonMode, true);
    assert.equal(buildLlmConfig({ provider: 'ollama' }).jsonMode, false);
    assert.equal(
      buildLlmConfig({ provider: 'openai', json_mode: false }).jsonMode,
      false,
    );
  });
});

describe('loadAgentConfig', () => {
  it('loads natl-agent.yml from cwd', () => {
    const dir = mkdtempSync(join(tmpdir(), 'natl-agent-cfg-'));
    writeFileSync(
      join(dir, 'natl-agent.yml'),
      [
        'llm:',
        '  provider: ollama',
        '  model: llama3.2:latest',
        '  parameters:',
        '    temperature: 0',
        '    max_tokens: 1024',
        'mode: stdout',
        'test_roots: [tests]',
      ].join('\n'),
      'utf8',
    );

    const cfg = loadAgentConfig({ cwd: dir });
    assert.equal(cfg.llm.provider, 'ollama');
    assert.equal(cfg.llm.model, 'llama3.2:latest');
    assert.equal(cfg.mode, 'stdout');
    assert.deepEqual(cfg.testRoots, ['tests']);
    assert.equal(cfg.selfHealing.enabled, false);
    assert.equal(cfg.selfHealing.maxRetries, 2);
    assert.ok(cfg.configPath?.endsWith('natl-agent.yml'));
  });

  it('loads self_healing from file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'natl-agent-heal-cfg-'));
    writeFileSync(
      join(dir, 'natl-agent.yml'),
      [
        'llm:',
        '  provider: ollama',
        '  model: llama3.2',
        'mode: stdout',
        'self_healing:',
        '  enabled: true',
        '  max_retries: 3',
      ].join('\n'),
      'utf8',
    );
    const cfg = loadAgentConfig({ cwd: dir });
    assert.equal(cfg.selfHealing.enabled, true);
    assert.equal(cfg.selfHealing.maxRetries, 3);
  });

  it('loads comment_provider and defaults to auto', () => {
    const dir = mkdtempSync(join(tmpdir(), 'natl-agent-pub-cfg-'));
    writeFileSync(
      join(dir, 'natl-agent.yml'),
      [
        'llm:',
        '  provider: ollama',
        '  model: llama3.2',
        'mode: comment',
        'comment_provider: gitlab',
      ].join('\n'),
      'utf8',
    );
    const cfg = loadAgentConfig({ cwd: dir });
    assert.equal(cfg.commentProvider, 'gitlab');
    assert.equal(cfg.gitlabApiUrl, 'https://gitlab.com/api/v4');
  });

  it('parseAgentFile rejects non-mapping', () => {
    assert.throws(() => parseAgentFile('- item\n'), /mapping/);
  });
});
