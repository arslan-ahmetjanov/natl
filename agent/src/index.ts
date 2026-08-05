export type {
  AgentConfig,
  ChangeType,
  CodeEntity,
  CommentProvider,
  ContextExample,
  DiffFile,
  DiffStatus,
  GeneratedTest,
  HealAttempt,
  HealErrorKind,
  LlmConfig,
  LlmParameters,
  LlmProvider,
  PipelineResult,
  RiskLevel,
  SelfHealingConfig,
  SupportedLanguage,
  UirChange,
} from './types.js';

export { fetchDiff, parseUnifiedDiff } from './diff.js';
export {
  analyzeSemanticDiff,
  analyzeSemanticDiffAsync,
  detectLanguage,
  splitPatchBodies,
  extractEntitiesHeuristic,
} from './semantic.js';
export {
  extractEntitiesTreeSitter,
  extractImportHints,
} from './treesitter.js';
export { buildContext } from './context.js';
export {
  SYSTEM_PROMPT,
  SELECTOR_HINTS,
  JSON_STEP_HINTS,
  buildUserPrompt,
  buildRepairPrompt,
  extractYamlFromResponse,
  extractJsonObjectFromResponse,
  extractNatlYamlFromResponse,
  natlJsonToYaml,
  suggestFileName,
} from './prompt.js';
export { chatCompletion, createLlmClient } from './llm.js';
export type { ChatMessage, LlmClient, LlmOptions, LlmResult } from './llm.js';
export {
  loadAgentConfig,
  buildLlmConfig,
  expandEnv,
  parseAgentFile,
  resolveConfigPath,
} from './config.js';
export type {
  FileLlmSection,
  FileSelfHealingSection,
  NatlAgentFileConfig,
} from './config.js';
export { validateNatlYaml, runNatlValidateCli } from './validate.js';
export {
  classifyValidationError,
  isHealableValidationError,
} from './heal.js';
export {
  normalizeNatlDocument,
  normalizeNatlYaml,
  expandStepAliases,
  splitMultiActionStep,
  PRIMARY_STEP_KEYS,
} from './normalize.js';
export type { NormalizeResult } from './normalize.js';
export { formatPrComment, publishResult, resolveCommentProvider } from './publish.js';
export type { PublishOptions } from './publish.js';
export { runAgent, loadConfigFromEnv } from './pipeline.js';
export type { RunAgentOptions, LlmOverrideMeta } from './pipeline.js';
