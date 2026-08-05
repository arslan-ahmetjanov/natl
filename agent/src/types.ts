/** Universal Intermediate Representation of a semantic code change. */
export type ChangeType =
  | 'FUNCTION_ADDED'
  | 'FUNCTION_REMOVED'
  | 'FUNCTION_CHANGED'
  | 'CLASS_ADDED'
  | 'CLASS_REMOVED'
  | 'CLASS_CHANGED'
  | 'FILE_ADDED'
  | 'FILE_REMOVED'
  | 'FILE_CHANGED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type SupportedLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'go'
  | 'csharp'
  | 'unknown';

export interface UirChange {
  file: string;
  language: SupportedLanguage;
  changeType: ChangeType;
  entity: string;
  description: string;
  risk: RiskLevel;
  /** Optional signature / snippet for the prompt. */
  detail?: string;
}

/** Extracted code symbol for semantic diff. */
export interface CodeEntity {
  kind: 'function' | 'class';
  name: string;
  signature: string;
}

export type DiffStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface DiffFile {
  path: string;
  status: DiffStatus;
  /** Unified diff hunk text (may be empty for binary). */
  patch: string;
  oldPath?: string;
}

export interface ContextExample {
  path: string;
  content: string;
  score: number;
}

export type LlmProvider = 'openai' | 'ollama' | 'azure' | 'custom';

export interface LlmParameters {
  /** Always forced to 0 for determinism. */
  temperature: number;
  maxTokens: number;
  topP?: number;
  seed?: number;
}

export interface LlmConfig {
  provider: LlmProvider;
  /** OpenAI-compatible base URL (…/v1). */
  endpoint: string;
  apiKey: string;
  model: string;
  parameters: LlmParameters;
  /** Azure OpenAI api-version query param. */
  apiVersion?: string;
  /**
   * Ask the API for JSON (`response_format: json_object`).
   * Default: true for openai/azure; false for ollama/custom.
   */
  jsonMode?: boolean;
}

/** Limited auto-repair of YAML that fails the validate gate. */
export interface SelfHealingConfig {
  /** Opt-in; default false. */
  enabled: boolean;
  /** Max repair LLM calls after the first failed validate (default 2). */
  maxRetries: number;
}

/** One failed validate before a repair attempt (or the final failure). */
export interface HealAttempt {
  /** 0 = initial generation; 1..N = after repair N. */
  attempt: number;
  error: string;
  /** schema | step | parse | other */
  kind: HealErrorKind;
}

export type HealErrorKind = 'schema' | 'step' | 'parse' | 'other';

/** Where to post the generated comment when mode=comment. */
export type CommentProvider = 'auto' | 'github' | 'gitlab' | 'stdout';

export interface AgentConfig {
  cwd: string;
  /** Git base ref for diff (e.g. origin/main). */
  baseRef: string;
  /** Git head ref (default HEAD). */
  headRef: string;
  llm: LlmConfig;
  /** Path to natl-agent.yml if loaded. */
  configPath?: string;
  /** Output mode. */
  mode: 'comment' | 'stdout' | 'commit';
  /** Comment backend when mode=comment (default auto). */
  commentProvider: CommentProvider;
  /** Where to look for existing NATL YAML (glob roots). */
  testRoots: string[];
  /** Max few-shot examples in the prompt. */
  maxExamples: number;
  /** Auto-repair invalid YAML after validate fail. */
  selfHealing: SelfHealingConfig;
  /** GitHub token for PR comments (optional). */
  githubToken?: string;
  /** owner/repo for GitHub API. */
  githubRepo?: string;
  /** PR number for comments. */
  githubPrNumber?: number;
  /** GitLab personal/project/job token for MR notes. */
  gitlabToken?: string;
  /** GitLab API v4 base (e.g. https://gitlab.com/api/v4). */
  gitlabApiUrl?: string;
  /** GitLab project id (numeric or URL-encoded path). */
  gitlabProjectId?: string;
  /** Merge request IID. */
  gitlabMrIid?: number;
}

export interface GeneratedTest {
  yaml: string;
  fileName: string;
  uir: UirChange[];
  validationOk: boolean;
  validationError?: string;
  /** Validate failures observed (including final if still failing). */
  healAttempts?: HealAttempt[];
  /** True if first validate failed and a later attempt passed (LLM or deterministic). */
  healed?: boolean;
  /** Deterministic normalize rewrites applied (split mega-step, aliases, …). */
  normalizeFixes?: string[];
}

export interface PipelineResult {
  diffs: DiffFile[];
  changes: UirChange[];
  tests: GeneratedTest[];
  published: boolean;
  message: string;
}
