import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLlmClient, chatCompletion } from './llm.js';
import type { LlmConfig } from './types.js';

describe('createLlmClient / chatCompletion', () => {
  it('posts to OpenAI-compatible URL with temperature 0', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};
    let capturedAuth = '';

    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedAuth = String((init?.headers as Record<string, string>)?.Authorization ?? '');
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'name: T\nsteps:\n  - log: ok\n' } }],
          model: 'gpt-4o-mini',
        }),
        { status: 200 },
      );
    };

    const config: LlmConfig = {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      parameters: { temperature: 0, maxTokens: 512, topP: 0.9, seed: 42 },
    };

    const client = createLlmClient(config, fetchImpl);
    const result = await client.complete([{ role: 'user', content: 'hi' }]);

    assert.equal(capturedUrl, 'https://api.openai.com/v1/chat/completions');
    assert.equal(capturedAuth, 'Bearer sk-test');
    assert.equal(capturedBody.temperature, 0);
    assert.equal(capturedBody.top_p, 0.9);
    assert.equal(capturedBody.seed, 42);
    assert.equal(capturedBody.max_tokens, 512);
    assert.deepEqual(capturedBody.response_format, { type: 'json_object' });
    assert.match(result.content, /name:/);
  });

  it('uses ollama endpoint without requiring API key', async () => {
    let capturedUrl = '';
    let hasAuth = false;

    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      const headers = init?.headers as Record<string, string>;
      hasAuth = Boolean(headers?.Authorization);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
        { status: 200 },
      );
    };

    await chatCompletion([{ role: 'user', content: 'x' }], {
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
      provider: 'ollama',
      allowEmptyApiKey: true,
      fetchImpl,
    });

    assert.equal(capturedUrl, 'http://localhost:11434/v1/chat/completions');
    assert.equal(hasAuth, false);
  });

  it('does not send response_format for ollama by default', async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
        { status: 200 },
      );
    };
    const client = createLlmClient(
      {
        provider: 'ollama',
        endpoint: 'http://localhost:11434/v1',
        apiKey: '',
        model: 'llama3.2',
        parameters: { temperature: 0, maxTokens: 64 },
        jsonMode: false,
      },
      fetchImpl,
    );
    await client.complete([{ role: 'user', content: 'hi' }]);
    assert.equal(body.response_format, undefined);
  });

  it('adds Azure api-key header and api-version', async () => {
    let capturedUrl = '';
    let apiKeyHeader = '';

    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      apiKeyHeader = String((init?.headers as Record<string, string>)?.['api-key'] ?? '');
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
        { status: 200 },
      );
    };

    await chatCompletion([{ role: 'user', content: 'x' }], {
      apiKey: 'azure-key',
      baseUrl: 'https://my.openai.azure.com/openai/deployments/gpt',
      model: 'gpt-4o-mini',
      provider: 'azure',
      apiVersion: '2024-08-01-preview',
      fetchImpl,
    });

    assert.match(capturedUrl, /api-version=2024-08-01-preview/);
    assert.equal(apiKeyHeader, 'azure-key');
  });

  it('forces temperature 0 even if options ask otherwise', async () => {
    let temperature: unknown;
    const fetchImpl: typeof fetch = async (_input, init) => {
      temperature = (JSON.parse(String(init?.body)) as { temperature: number }).temperature;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
        { status: 200 },
      );
    };

    await chatCompletion([{ role: 'user', content: 'x' }], {
      apiKey: 'k',
      baseUrl: 'https://api.openai.com/v1',
      model: 'm',
      temperature: 0.9,
      fetchImpl,
    });
    assert.equal(temperature, 0);
  });
});
