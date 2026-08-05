import type { LlmConfig, LlmProvider } from './types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResult {
  content: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface LlmClient {
  complete(messages: ChatMessage[]): Promise<LlmResult>;
  readonly config: LlmConfig;
}

/** @deprecated Use LlmConfig via createLlmClient; kept for low-level tests. */
export interface LlmOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  provider?: LlmProvider;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  /** Allow empty API key (ollama/local). */
  allowEmptyApiKey?: boolean;
  /** Send response_format json_object when true. */
  jsonMode?: boolean;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

function buildHeaders(opts: {
  provider: LlmProvider;
  apiKey: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.provider === 'azure') {
    if (opts.apiKey) headers['api-key'] = opts.apiKey;
  } else if (opts.apiKey) {
    headers.Authorization = `Bearer ${opts.apiKey}`;
  }
  return headers;
}

function buildUrl(baseUrl: string, provider: LlmProvider, apiVersion?: string): string {
  let url = joinUrl(baseUrl, 'chat/completions');
  if (provider === 'azure') {
    const version = apiVersion ?? '2024-08-01-preview';
    url += (url.includes('?') ? '&' : '?') + `api-version=${encodeURIComponent(version)}`;
  }
  return url;
}

/**
 * OpenAI-compatible Chat Completions (OpenAI, Ollama, Azure, vLLM, NIM, …).
 * `temperature` is always sent as 0.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: LlmOptions,
): Promise<LlmResult> {
  const provider = opts.provider ?? 'openai';
  const allowEmpty =
    opts.allowEmptyApiKey ?? (provider === 'ollama' || provider === 'custom');
  if (!opts.apiKey && !allowEmpty) {
    throw new Error(
      'Missing LLM API key (LLM_API_KEY / OPENAI_API_KEY). For local Ollama set provider: ollama.',
    );
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = buildUrl(opts.baseUrl, provider, opts.apiVersion);
  const body: Record<string, unknown> = {
    model: opts.model,
    temperature: 0,
    max_tokens: opts.maxTokens ?? 2048,
    messages,
  };
  if (opts.topP !== undefined) body.top_p = opts.topP;
  if (opts.seed !== undefined) body.seed = opts.seed;
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: buildHeaders({ provider, apiKey: opts.apiKey }),
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(
      `LLM HTTP ${res.status} ${res.statusText}: ${rawText.slice(0, 500)}`,
    );
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    data = JSON.parse(rawText) as typeof data;
  } catch {
    throw new Error(`LLM returned non-JSON: ${rawText.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM response missing choices[0].message.content');
  }

  return {
    content,
    model: data.model ?? opts.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    },
  };
}

export function createLlmClient(
  config: LlmConfig,
  fetchImpl?: typeof fetch,
): LlmClient {
  return {
    config,
    complete(messages: ChatMessage[]) {
      return chatCompletion(messages, {
        apiKey: config.apiKey,
        baseUrl: config.endpoint,
        model: config.model,
        temperature: 0,
        maxTokens: config.parameters.maxTokens,
        topP: config.parameters.topP,
        seed: config.parameters.seed,
        provider: config.provider,
        apiVersion: config.apiVersion,
        jsonMode:
          config.jsonMode ??
          (config.provider === 'openai' || config.provider === 'azure'),
        fetchImpl,
        allowEmptyApiKey:
          config.provider === 'ollama' || config.provider === 'custom',
      });
    },
  };
}
