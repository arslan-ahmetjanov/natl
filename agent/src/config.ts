import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AgentConfig, CommentProvider, LlmConfig, LlmProvider } from './types.js';

const PROVIDERS = new Set<LlmProvider>(['openai', 'ollama', 'azure', 'custom']);

const DEFAULT_ENDPOINTS: Record<LlmProvider, string> = {
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
  azure: '',
  custom: 'http://localhost:8080/v1',
};

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: 'gpt-4o-mini',
  ollama: 'llama3.2',
  azure: 'gpt-4o-mini',
  custom: 'gpt-4o-mini',
};

/** Replace `${VAR}` / `$VAR` with process.env values. */
export function expandEnv(value: string): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, a, b) => {
    const key = (a ?? b) as string;
    return process.env[key] ?? '';
  });
}

function asProvider(raw: unknown): LlmProvider {
  const p = String(raw ?? 'openai').toLowerCase() as LlmProvider;
  if (!PROVIDERS.has(p)) {
    throw new Error(`Unknown llm.provider: ${String(raw)} (expected openai|ollama|azure|custom)`);
  }
  return p;
}

function asNumber(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return fallback;
}

export interface FileLlmSection {
  provider?: string;
  endpoint?: string;
  api_key?: string;
  model?: string;
  api_version?: string;
  /** Prefer JSON object responses (OpenAI-compatible response_format). */
  json_mode?: boolean;
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    seed?: number;
  };
}

export interface FileSelfHealingSection {
  enabled?: boolean;
  max_retries?: number;
}

export interface NatlAgentFileConfig {
  llm?: FileLlmSection;
  base_ref?: string;
  head_ref?: string;
  mode?: string;
  comment_provider?: string;
  test_roots?: string[] | string;
  max_examples?: number;
  self_healing?: FileSelfHealingSection;
  gitlab_api_url?: string;
  gitlab_project_id?: string | number;
  gitlab_mr_iid?: number | string;
}

const DEFAULT_SELF_HEALING = { enabled: false, maxRetries: 2 } as const;
const COMMENT_PROVIDERS = new Set<CommentProvider>([
  'auto',
  'github',
  'gitlab',
  'stdout',
]);

function asCommentProvider(raw: unknown, fallback: CommentProvider): CommentProvider {
  const p = String(raw ?? fallback).toLowerCase() as CommentProvider;
  return COMMENT_PROVIDERS.has(p) ? p : fallback;
}

function asOptionalNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return undefined;
}

function asBoolean(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return fallback;
}

export function resolveConfigPath(cwd: string, explicit?: string): string | undefined {
  if (explicit) {
    const p = isAbsolute(explicit) ? explicit : resolve(cwd, explicit);
    return existsSync(p) ? p : undefined;
  }
  for (const name of ['natl-agent.yml', 'natl-agent.yaml', '.natl-agent.yml']) {
    const p = join(cwd, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

export function parseAgentFile(raw: string): NatlAgentFileConfig {
  const doc = parseYaml(raw);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('natl-agent.yml root must be a mapping');
  }
  return doc as NatlAgentFileConfig;
}

export function buildLlmConfig(
  file: FileLlmSection | undefined,
  overrides: Partial<LlmConfig> = {},
): LlmConfig {
  const provider = overrides.provider ?? asProvider(file?.provider ?? process.env.NATL_AGENT_PROVIDER ?? 'openai');
  const endpoint =
    overrides.endpoint ??
    (file?.endpoint ? expandEnv(String(file.endpoint)) : undefined) ??
    process.env.OPENAI_BASE_URL ??
    process.env.NATL_AGENT_ENDPOINT ??
    DEFAULT_ENDPOINTS[provider];

  if (provider === 'azure' && !endpoint) {
    throw new Error('Azure provider requires llm.endpoint (Azure OpenAI resource URL)');
  }

  const apiKey =
    overrides.apiKey ??
    (file?.api_key ? expandEnv(String(file.api_key)) : undefined) ??
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.NATL_AGENT_API_KEY ??
    '';

  const model =
    overrides.model ??
    (file?.model ? expandEnv(String(file.model)) : undefined) ??
    process.env.OPENAI_MODEL ??
    process.env.NATL_AGENT_MODEL ??
    DEFAULT_MODELS[provider];

  const maxTokens =
    overrides.parameters?.maxTokens ??
    asNumber(file?.parameters?.max_tokens, 2048);

  const topP =
    overrides.parameters?.topP ??
    (file?.parameters?.top_p !== undefined ? asNumber(file.parameters.top_p, 0.9) : 0.9);

  const seed =
    overrides.parameters?.seed ??
    (file?.parameters?.seed !== undefined ? asNumber(file.parameters.seed, 42) : 42);

  // Determinism: always temperature 0 (ignore file/env non-zero).
  const requested =
    overrides.parameters?.temperature ??
    (file?.parameters?.temperature !== undefined
      ? asNumber(file.parameters.temperature, 0)
      : 0);
  if (requested !== 0) {
    console.warn(
      `[natl-agent] temperature=${requested} ignored; forcing 0 for determinism`,
    );
  }

  const defaultJsonMode = provider === 'openai' || provider === 'azure';
  const jsonMode =
    overrides.jsonMode ??
    (file?.json_mode !== undefined
      ? asBoolean(file.json_mode, defaultJsonMode)
      : undefined) ??
    (process.env.NATL_AGENT_JSON_MODE !== undefined
      ? asBoolean(process.env.NATL_AGENT_JSON_MODE, defaultJsonMode)
      : defaultJsonMode);

  return {
    provider,
    endpoint: endpoint.replace(/\/+$/, ''),
    apiKey,
    model,
    apiVersion:
      overrides.apiVersion ??
      (file?.api_version ? expandEnv(String(file.api_version)) : undefined) ??
      process.env.AZURE_OPENAI_API_VERSION ??
      (provider === 'azure' ? '2024-08-01-preview' : undefined),
    jsonMode,
    parameters: {
      temperature: 0,
      maxTokens,
      topP,
      seed,
    },
  };
}

export function loadAgentConfig(opts: {
  cwd?: string;
  configPath?: string;
  overrides?: Partial<AgentConfig> & { cwd?: string };
}): AgentConfig {
  const cwd = opts.cwd ?? opts.overrides?.cwd ?? process.cwd();
  const configPath = resolveConfigPath(cwd, opts.configPath);
  let file: NatlAgentFileConfig = {};
  if (configPath) {
    file = parseAgentFile(readFileSync(configPath, 'utf8'));
  }

  const ov = opts.overrides ?? {};
  const testRoots =
    ov.testRoots ??
    (Array.isArray(file.test_roots)
      ? file.test_roots.map(String)
      : typeof file.test_roots === 'string'
        ? file.test_roots.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined) ??
    (process.env.NATL_AGENT_TEST_ROOTS ?? 'tests,examples')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const modeRaw =
    ov.mode ??
    (file.mode as AgentConfig['mode'] | undefined) ??
    (process.env.NATL_AGENT_MODE as AgentConfig['mode'] | undefined) ??
    'comment';

  const commentProvider = asCommentProvider(
    ov.commentProvider ??
      file.comment_provider ??
      process.env.NATL_AGENT_COMMENT_PROVIDER,
    'auto',
  );

  let prNumber = ov.githubPrNumber;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (prNumber == null && eventPath && existsSync(eventPath)) {
    try {
      const ev = JSON.parse(readFileSync(eventPath, 'utf8')) as {
        pull_request?: { number?: number };
        number?: number;
      };
      prNumber = ev.pull_request?.number ?? ev.number;
    } catch {
      /* ignore */
    }
  }
  // Jenkins GitHub Multibranch / ghprb
  if (prNumber == null) {
    prNumber =
      asOptionalNumber(process.env.CHANGE_ID) ??
      asOptionalNumber(process.env.ghprbPullId);
  }

  const gitlabMrIid =
    ov.gitlabMrIid ??
    asOptionalNumber(file.gitlab_mr_iid) ??
    asOptionalNumber(process.env.CI_MERGE_REQUEST_IID) ??
    asOptionalNumber(process.env.GITLAB_MR_IID);

  const gitlabProjectId =
    ov.gitlabProjectId ??
    (file.gitlab_project_id != null ? String(file.gitlab_project_id) : undefined) ??
    process.env.CI_PROJECT_ID ??
    process.env.GITLAB_PROJECT_ID;

  const gitlabApiUrl = (
    ov.gitlabApiUrl ??
    (file.gitlab_api_url ? expandEnv(String(file.gitlab_api_url)) : undefined) ??
    process.env.CI_API_V4_URL ??
    process.env.GITLAB_API_URL ??
    'https://gitlab.com/api/v4'
  ).replace(/\/+$/, '');

  // Prefer explicit base; else GitLab MR target / Diff base SHA when present.
  const gitlabBase =
    process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA ||
    (process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME
      ? `origin/${process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME}`
      : undefined);

  const shFile = file.self_healing;
  const selfHealing = ov.selfHealing ?? {
    enabled: asBoolean(
      shFile?.enabled ?? process.env.NATL_AGENT_SELF_HEALING,
      DEFAULT_SELF_HEALING.enabled,
    ),
    maxRetries: Math.max(
      0,
      Math.floor(
        asNumber(
          shFile?.max_retries ?? process.env.NATL_AGENT_SELF_HEALING_MAX_RETRIES,
          DEFAULT_SELF_HEALING.maxRetries,
        ),
      ),
    ),
  };

  return {
    cwd,
    configPath,
    baseRef:
      ov.baseRef ??
      file.base_ref ??
      process.env.NATL_AGENT_BASE_REF ??
      gitlabBase ??
      'origin/main',
    headRef:
      ov.headRef ??
      file.head_ref ??
      process.env.NATL_AGENT_HEAD_REF ??
      'HEAD',
    llm: buildLlmConfig(file.llm, ov.llm),
    mode: modeRaw,
    commentProvider,
    testRoots,
    maxExamples:
      ov.maxExamples ??
      asNumber(file.max_examples, Number(process.env.NATL_AGENT_MAX_EXAMPLES ?? 3)),
    selfHealing,
    githubToken: ov.githubToken ?? process.env.GITHUB_TOKEN,
    githubRepo: ov.githubRepo ?? process.env.GITHUB_REPOSITORY,
    githubPrNumber: prNumber,
    gitlabToken:
      ov.gitlabToken ??
      process.env.GITLAB_TOKEN ??
      process.env.PRIVATE_TOKEN ??
      process.env.CI_JOB_TOKEN,
    gitlabApiUrl,
    gitlabProjectId,
    gitlabMrIid,
  };
}
