import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchDiff } from './diff.js';
import { analyzeSemanticDiffAsync } from './semantic.js';
import { buildContext } from './context.js';
import {
  buildRepairPrompt,
  buildUserPrompt,
  extractNatlYamlFromResponse,
  suggestFileName,
  SYSTEM_PROMPT,
} from './prompt.js';
import { createLlmClient } from './llm.js';
import type { ChatMessage } from './llm.js';
import { loadAgentConfig } from './config.js';
import { classifyValidationError, isHealableValidationError } from './heal.js';
import { normalizeNatlYaml } from './normalize.js';
import { validateNatlYaml, runNatlValidateCli } from './validate.js';
import { formatPrComment, publishResult } from './publish.js';
import type {
  AgentConfig,
  GeneratedTest,
  HealAttempt,
  PipelineResult,
  UirChange,
} from './types.js';

export interface LlmOverrideMeta {
  /** 0 = initial generation; 1..N = repair attempt. */
  attempt: number;
  validationError?: string;
  previousYaml?: string;
}

export interface RunAgentOptions {
  config: AgentConfig;
  /**
   * Skip live LLM (tests).
   * Second arg is set on repair calls when self-healing runs.
   */
  llmOverride?: (prompt: string, meta?: LlmOverrideMeta) => Promise<string>;
  /**
   * Extra CLI `natl validate` after in-process gates.
   * Default false — in-process AJV + parseNatlDocument is the required gate.
   */
  useCliValidate?: boolean;
  fetchImpl?: typeof fetch;
}

function pickPrimaryChanges(changes: UirChange[]): UirChange[] {
  const actionable = changes.filter(
    (c) => c.changeType !== 'FILE_CHANGED' || c.language !== 'unknown',
  );
  const high = actionable.filter((c) => c.risk === 'HIGH');
  const pool = high.length ? high : actionable;
  return pool.slice(0, 8);
}

async function callLlm(
  opts: RunAgentOptions,
  messages: ChatMessage[],
  userPrompt: string,
  meta: LlmOverrideMeta,
): Promise<string> {
  if (opts.llmOverride) {
    return opts.llmOverride(userPrompt, meta);
  }
  const client = createLlmClient(opts.config.llm, opts.fetchImpl);
  const llm = await client.complete(messages);
  return llm.content;
}

function runGate(
  yaml: string,
  fileName: string,
  opts: RunAgentOptions,
): { ok: boolean; error?: string } {
  let validation = validateNatlYaml(yaml, fileName);
  if (validation.ok && opts.useCliValidate) {
    validation = runNatlValidateCli(yaml, { cwd: opts.config.cwd });
  }
  return validation;
}

/** Extract model output → YAML string (before deterministic normalize). */
function extractOnly(raw: string): string {
  return extractNatlYamlFromResponse(raw);
}

function applyNormalize(yaml: string): { yaml: string; normalizeFixes: string[] } {
  const norm = normalizeNatlYaml(yaml);
  return {
    yaml: norm.yaml,
    normalizeFixes: norm.changed ? norm.fixes : [],
  };
}

/**
 * Full agent pipeline: diff → UIR → context → LLM → validate → [heal] → publish.
 */
export async function runAgent(opts: RunAgentOptions): Promise<PipelineResult> {
  const { config } = opts;
  const diffs = await fetchDiff({
    cwd: config.cwd,
    baseRef: config.baseRef,
    headRef: config.headRef,
  });

  const allChanges = await analyzeSemanticDiffAsync(diffs);
  const changes = pickPrimaryChanges(allChanges);

  if (!changes.length) {
    return {
      diffs,
      changes: allChanges,
      tests: [],
      published: false,
      message: 'No actionable semantic changes in diff.',
    };
  }

  const examples = buildContext({
    cwd: config.cwd,
    roots: config.testRoots,
    changes,
    maxExamples: config.maxExamples,
  });

  const patchHints = diffs
    .filter((d) => changes.some((c) => c.file === d.path))
    .map((d) => d.patch)
    .join('\n')
    .slice(0, 8000);

  const userPrompt = buildUserPrompt({ changes, examples, patchHints });
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  let raw = await callLlm(opts, messages, userPrompt, { attempt: 0 });
  let yaml = extractOnly(raw);
  const fileName = suggestFileName(changes);

  // Deterministic normalize before gate (and record if it alone fixes the doc).
  const beforeNorm = runGate(yaml, fileName, opts);
  let { yaml: normalizedYaml, normalizeFixes } = applyNormalize(yaml);
  yaml = normalizedYaml;
  let validation = runGate(yaml, fileName, opts);
  const healAttempts: HealAttempt[] = [];
  let healed = false;

  if (
    !beforeNorm.ok &&
    validation.ok &&
    normalizeFixes.length &&
    beforeNorm.error
  ) {
    healed = true;
    healAttempts.push({
      attempt: 0,
      error: beforeNorm.error,
      kind: classifyValidationError(beforeNorm.error),
    });
  }

  const healing = config.selfHealing;
  let repairUsed = 0;

  while (
    !validation.ok &&
    healing.enabled &&
    repairUsed < healing.maxRetries &&
    validation.error &&
    isHealableValidationError(validation.error)
  ) {
    const kind = classifyValidationError(validation.error);
    healAttempts.push({
      attempt: repairUsed,
      error: validation.error,
      kind,
    });

    messages.push({ role: 'assistant', content: yaml });
    const repairPrompt = buildRepairPrompt({
      previousYaml: yaml,
      validationError: validation.error,
      attempt: repairUsed + 1,
      maxRetries: healing.maxRetries,
      kind,
    });
    messages.push({ role: 'user', content: repairPrompt });

    raw = await callLlm(opts, messages, repairPrompt, {
      attempt: repairUsed + 1,
      validationError: validation.error,
      previousYaml: yaml,
    });
    yaml = extractOnly(raw);
    const next = applyNormalize(yaml);
    yaml = next.yaml;
    if (next.normalizeFixes.length) {
      normalizeFixes = [...normalizeFixes, ...next.normalizeFixes];
    }
    validation = runGate(yaml, fileName, opts);
    repairUsed += 1;

    if (validation.ok) {
      healed = true;
      break;
    }
  }

  if (!validation.ok && validation.error) {
    // Record final failure (whether healing was off, exhausted, or non-healable).
    const lastAttempt = healAttempts[healAttempts.length - 1];
    const finalAttempt = repairUsed;
    if (!lastAttempt || lastAttempt.attempt !== finalAttempt || lastAttempt.error !== validation.error) {
      healAttempts.push({
        attempt: finalAttempt,
        error: validation.error,
        kind: classifyValidationError(validation.error),
      });
    }
  }

  const test: GeneratedTest = {
    yaml,
    fileName,
    uir: changes,
    validationOk: validation.ok,
    validationError: validation.error,
    healAttempts: healAttempts.length ? healAttempts : undefined,
    healed: healed || undefined,
    normalizeFixes: normalizeFixes.length ? normalizeFixes : undefined,
  };

  // Gate always enforced: never commit invalid YAML (even after healing attempts).
  if (config.mode === 'commit' && validation.ok) {
    const outDir = join(config.cwd, config.testRoots[0] ?? 'tests');
    const outPath = join(outDir, fileName);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, yaml.endsWith('\n') ? yaml : `${yaml}\n`, 'utf8');
  }

  const body = formatPrComment([test]);
  const pub = await publishResult({
    mode: config.mode === 'commit' ? 'stdout' : config.mode,
    body,
    commentProvider: config.commentProvider,
    githubToken: config.githubToken,
    githubRepo: config.githubRepo,
    githubPrNumber: config.githubPrNumber,
    gitlabToken: config.gitlabToken,
    gitlabApiUrl: config.gitlabApiUrl,
    gitlabProjectId: config.gitlabProjectId,
    gitlabMrIid: config.gitlabMrIid,
    fetchImpl: opts.fetchImpl,
  });

  return {
    diffs,
    changes: allChanges,
    tests: [test],
    published: pub.published,
    message: pub.published ? pub.message : body,
  };
}

/** @deprecated Prefer loadAgentConfig — kept as thin wrapper. */
export function loadConfigFromEnv(
  overrides: Partial<AgentConfig> & { cwd?: string } = {},
): AgentConfig {
  return loadAgentConfig({ cwd: overrides.cwd, overrides });
}
