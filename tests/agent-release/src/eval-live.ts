/**
 * Live LLM eval: sanitized PR-diff corpus → LLM → validateNatlYaml.
 *
 * Env:
 *   LIVE_EVAL_N          corpus size (default 50)
 *   LIVE_EVAL_TARGET     min validate pass rate (default 0.70)
 *   LIVE_EVAL_DRY        if 1 — corpus + UIR only, no LLM (tooling smoke)
 *   OPENAI_BASE_URL / NATL_AGENT_ENDPOINT  (default http://127.0.0.1:8787/v1)
 *   OPENAI_MODEL / NATL_AGENT_MODEL
 *   NATL_AGENT_PROVIDER  (default custom for local-llm)
 *   LLM_API_KEY          optional for ollama/custom
 *   LIVE_EVAL_HEAL       if 0 — disable self-healing (default on)
 *
 * Report: ../../agent/eval/live-report.json (gitignored)
 *
 * Run: pnpm eval:live
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeSemanticDiffAsync,
  buildRepairPrompt,
  buildUserPrompt,
  classifyValidationError,
  createLlmClient,
  extractYamlFromResponse,
  isHealableValidationError,
  parseUnifiedDiff,
  SYSTEM_PROMPT,
  validateNatlYaml,
} from '@natl/agent';
import type { ContextExample, LlmProvider } from '@natl/agent';
import {
  buildLiveCorpus,
  LIVE_CORPUS_DEFAULT_N,
  LIVE_EVAL_TARGET_DEFAULT,
} from './live-corpus.js';

const here = dirname(fileURLToPath(import.meta.url));
const reportPath = join(here, '..', '..', '..', 'agent', 'eval', 'live-report.json');

const FEW_SHOT: ContextExample[] = [
  {
    path: 'examples/http_only.yaml',
    score: 10,
    content: `name: HTTP smoke get_user
engine: http
steps:
  - get: https://example.com/api/user
    save: r
  - assert: $r.status == 200
`,
  },
  {
    path: 'examples/login.yaml',
    score: 8,
    content: `name: UI login
engine: playwright
vars:
  base_url: ./fixtures/sandbox.html
steps:
  - goto: $base_url
  - fill: "#email"
    with: demo@natl.dev
  - click: "#login-btn"
  - assert: ".welcome"
    visible: true
`,
  },
];

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

async function health(url: string): Promise<boolean> {
  try {
    const base = url.replace(/\/v1\/?$/, '');
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) return true;
  } catch {
    /* try models */
  }
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/models`, {
      signal: AbortSignal.timeout(2500),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const argv = new Set(process.argv.slice(2));
  const n = Number(process.env.LIVE_EVAL_N ?? LIVE_CORPUS_DEFAULT_N);
  const target = Number(process.env.LIVE_EVAL_TARGET ?? LIVE_EVAL_TARGET_DEFAULT);
  const dry = process.env.LIVE_EVAL_DRY === '1' || argv.has('--dry');
  const heal =
    process.env.LIVE_EVAL_HEAL !== '0' && process.env.LIVE_EVAL_HEAL !== 'false';
  const maxRetries = Math.max(0, Number(process.env.LIVE_EVAL_MAX_RETRIES ?? 2));

  const provider = (process.env.NATL_AGENT_PROVIDER ??
    process.env.LIVE_EVAL_PROVIDER ??
    'custom') as LlmProvider;
  const endpoint = (
    process.env.OPENAI_BASE_URL ??
    process.env.NATL_AGENT_ENDPOINT ??
    'http://127.0.0.1:8787/v1'
  ).replace(/\/+$/, '');
  const model =
    process.env.OPENAI_MODEL ??
    process.env.NATL_AGENT_MODEL ??
    'onnx-community/Qwen2.5-0.5B-Instruct';
  const apiKey =
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.NATL_AGENT_API_KEY ??
    '';

  const corpus = buildLiveCorpus(n);
  const startedAt = new Date().toISOString();

  if (dry) {
    let uirOk = 0;
    for (const c of corpus) {
      const files = parseUnifiedDiff(c.diff);
      const uir = await analyzeSemanticDiffAsync(files);
      if (uir.some((u) => u.entity.includes(c.entity.replace(/\d+$/, '')) || u.entity === c.entity || uir.length > 0)) {
        uirOk++;
      }
    }
    const report = {
      kind: 'live-llm-eval',
      dryRun: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      total: corpus.length,
      uirExtracted: uirOk,
      note: 'LIVE_EVAL_DRY=1 — corpus + UIR only, no LLM calls',
      targetRate: target,
      model: null,
      endpoint: null,
    };
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(report, null, 2));
    console.log(`Wrote ${reportPath}`);
    if (uirOk < corpus.length * 0.9) {
      console.error('FAIL: UIR extraction too low on sanitized corpus');
      process.exit(1);
    }
    console.log('PASS: dry live-eval corpus OK');
    return;
  }

  const up = await health(endpoint);
  if (!up) {
    const msg =
      `LLM not reachable at ${endpoint}. Start local-llm (node scripts/local-llm/setup.mjs && cd local-llm && npm start) ` +
      `or point OPENAI_BASE_URL at Ollama/cloud.`;
    console.error(msg);
    process.exit(2);
  }

  const client = createLlmClient({
    provider,
    endpoint,
    apiKey,
    model,
    parameters: { temperature: 0, maxTokens: 1024, topP: 0.9, seed: 42 },
  });

  let passed = 0;
  const latencies: number[] = [];
  const failures: Array<{
    id: number;
    entity: string;
    error?: string;
    healed?: boolean;
  }> = [];

  for (const c of corpus) {
    const files = parseUnifiedDiff(c.diff);
    const changes = await analyzeSemanticDiffAsync(files);
    const primary = changes.length
      ? changes
      : [
          {
            file: c.path,
            language: c.language as 'python',
            changeType: 'FUNCTION_ADDED' as const,
            entity: c.entity,
            description: `sanitized fixture ${c.id}`,
            risk: 'HIGH' as const,
          },
        ];

    const userPrompt = buildUserPrompt({
      changes: primary,
      examples: FEW_SHOT,
      patchHints: c.diff,
    });

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    const t0 = Date.now();
    let yaml = '';
    let validationError: string | undefined;
    let ok = false;
    let healed = false;

    try {
      const llm = await client.complete(messages);
      yaml = extractYamlFromResponse(llm.content);
      let v = validateNatlYaml(yaml, `live_${c.id}.yaml`);
      ok = v.ok;
      validationError = v.error;

      let repair = 0;
      while (
        !ok &&
        heal &&
        repair < maxRetries &&
        validationError &&
        isHealableValidationError(validationError)
      ) {
        const kind = classifyValidationError(validationError);
        messages.push({ role: 'assistant', content: yaml });
        const repairPrompt = buildRepairPrompt({
          previousYaml: yaml,
          validationError,
          attempt: repair + 1,
          maxRetries,
          kind,
        });
        messages.push({ role: 'user', content: repairPrompt });
        const fixed = await client.complete(messages);
        yaml = extractYamlFromResponse(fixed.content);
        v = validateNatlYaml(yaml, `live_${c.id}.yaml`);
        ok = v.ok;
        validationError = v.error;
        repair += 1;
        if (ok) healed = true;
      }
    } catch (err) {
      validationError = err instanceof Error ? err.message : String(err);
      ok = false;
    }

    const ms = Date.now() - t0;
    latencies.push(ms);

    if (ok) passed++;
    else failures.push({ id: c.id, entity: c.entity, error: validationError, healed });

    process.stdout.write(
      `[live-eval] ${c.id + 1}/${corpus.length} ${c.entity} ${ok ? 'OK' : 'FAIL'} ${ms}ms\n`,
    );
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const rate = passed / corpus.length;
  const report = {
    kind: 'live-llm-eval',
    dryRun: false,
    startedAt,
    finishedAt: new Date().toISOString(),
    total: corpus.length,
    passed,
    failed: corpus.length - passed,
    rate,
    targetRate: target,
    ok: rate >= target,
    selfHealing: heal,
    maxRetries: heal ? maxRetries : 0,
    model,
    provider,
    endpoint,
    latencyMs: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      mean: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
    },
    note:
      'Sanitized synthetic PR diffs (no private PRs / secrets). Gate = validateNatlYaml after live LLM.',
    sampleFailures: failures.slice(0, 8),
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${reportPath}`);

  if (!report.ok) {
    console.error(`FAIL: live validate rate ${rate.toFixed(3)} < ${target}`);
    process.exit(1);
  }
  console.log(`PASS: live validate rate ${rate.toFixed(3)} >= ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
