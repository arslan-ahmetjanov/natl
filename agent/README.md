# @natl/agent

CI agent that turns a **git diff** into suggested **NATL YAML** tests via an **OpenAI-compatible LLM Gateway**. The model is prompted for **JSON** shaped like `natl.test.schema.json`; the agent converts it to YAML, then gates with AJV + `parseNatlDocument` (same bar as `natl validate`). YAML replies still work as a fallback.

## Install

```bash
npm install -D @natl/agent @natl/cli
```

## Config (`natl-agent.yml`)

```yaml
llm:
  provider: openai   # openai | ollama | azure | custom
  endpoint: https://api.openai.com/v1
  api_key: ${LLM_API_KEY}
  model: gpt-4o-mini
  parameters:
    temperature: 0    # always forced to 0
    max_tokens: 2048
    top_p: 0.9
    seed: 42
  json_mode: true     # openai/azure default; sends response_format json_object
mode: comment
test_roots: [tests, examples]
self_healing:
  enabled: false      # set true to auto-repair invalid output
  max_retries: 2      # repair LLM calls after first failed validate
```

Generation path: **LLM JSON → YAML → deterministic normalize → validate** (optional LLM self-heal). Set `llm.json_mode: false` (or `NATL_AGENT_JSON_MODE=0`) for providers that reject `response_format`.

### Deterministic normalize

Always runs before the validate gate (no LLM):

- Split a mega-step with several verbs (`goto`+`fill`+`click`+…) into one step per verb
- Expand aliases (`fill+with`, `assert+text`, `submit-button`, …)
- Move top-level `assertions` into `steps`
- Infer `engine: http` / `playwright` when missing

LLM `self_healing` is a second line of defense for errors normalize cannot fix.

## Model recommendations

| Tier | Models | Notes |
|------|--------|--------|
| **Recommended (CI)** | OpenAI `gpt-4o-mini`, `gpt-4.1-mini`; Anthropic via OpenAI-compatible proxy; Azure same deployments | Use `json_mode: true`. Expect high validate pass rate with normalize. |
| **Recommended (local)** | Ollama `llama3.2` (3B+), `qwen2.5:7b`, `mistral` / `mistral-nemo` | Set `provider: ollama`, `json_mode: false` unless the build supports `response_format`. Prefer ≥3B. |
| **OK for smoke** | `qwen2.5:1.5b`, `phi3:mini` | Often needs normalize + optional `self_healing`. Review YAML before commit. |
| **Not for production gate** | Transformers.js **0.5B** (`local-llm` tiny), other sub-1B instruct models | Useful to smoke the pipeline only. Keys improve with JSON prompts, but structure is unreliable; do not expect ≥70% live validate. |

Practical defaults:

```yaml
# Cloud CI
llm:
  provider: openai
  model: gpt-4o-mini
  json_mode: true

# Local offline
llm:
  provider: ollama
  model: llama3.2
  endpoint: http://127.0.0.1:11434/v1
  json_mode: false
```

Keep `temperature: 0` (forced). Enable `self_healing` in CI if you want LLM retries after normalize.

Examples in `examples/`:

| File | Use case |
|------|----------|
| `natl-agent.openai.yml` | Cloud OpenAI |
| `natl-agent.ollama.yml` | Local Ollama (offline) |
| `natl-agent.azure.yml` | Azure OpenAI |
| `natl-agent.custom.yml` | vLLM / NIM / LM Studio / LocalAI |
| `natl-agent.self-healing.yml` | Validate-gate repair loop |
| `natl-agent.gitlab.yml` | GitLab MR comment provider |

## CLI

```bash
# Cloud
export LLM_API_KEY=sk-...
natl-agent --config examples/natl-agent.openai.yml --mode stdout

# Local Ollama (no API key)
ollama serve && ollama pull llama3.2
natl-agent --config examples/natl-agent.ollama.yml --mode stdout

# Flags override file/env
natl-agent --provider ollama --base-url http://127.0.0.1:11434/v1 --model llama3.2
```

| Flag / env | Meaning |
|------------|---------|
| `--config` | Path to `natl-agent.yml` |
| `LLM_API_KEY` / `OPENAI_API_KEY` | Cloud key (optional for `ollama`) |
| `OPENAI_BASE_URL` / `NATL_AGENT_ENDPOINT` | Base URL `…/v1` |
| `--provider` / `NATL_AGENT_PROVIDER` | `openai` \| `ollama` \| `azure` \| `custom` |
| `--mode` | `comment` \| `stdout` \| `commit` |
| `--comment-provider` / `NATL_AGENT_COMMENT_PROVIDER` | `auto` \| `github` \| `gitlab` \| `stdout` |
| `--cli-validate` | Extra gate via `npx @natl/cli validate` |
| `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | GitHub PR comment |
| `GITLAB_TOKEN` / `CI_JOB_TOKEN`, `CI_PROJECT_ID`, `CI_MERGE_REQUEST_IID` | GitLab MR note |

**Determinism:** every request sends `temperature: 0` (non-zero config values are ignored with a warning).

## GitHub Actions

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: ./agent
  with:
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
    openai_base_url: ${{ vars.OPENAI_BASE_URL }}
    openai_model: ${{ vars.OPENAI_MODEL }}
    base_ref: origin/${{ github.base_ref }}
    config: natl-agent.yml   # optional
```

## CI beyond GitHub

Publisher is not GitHub-only: `comment_provider: auto | github | gitlab | stdout`.

| CI | Example | Dry-run |
|----|---------|---------|
| GitLab CI | [`examples/ci/gitlab-ci.yml`](../examples/ci/gitlab-ci.yml) | `NATL_AGENT_MODE=stdout` |
| Jenkins | [`examples/ci/Jenkinsfile`](../examples/ci/Jenkinsfile) | parameter `AGENT_MODE=stdout` |
| Details | [`examples/ci/README.md`](../examples/ci/README.md) | — |

```yaml
# natl-agent.yml
mode: comment
comment_provider: auto   # gitlab if CI_MERGE_REQUEST_IID + token; else github; else stdout
```

GitLab posts to `POST /projects/:id/merge_requests/:iid/notes`. Existing GitHub Action path is unchanged (`comment_provider: auto` picks GitHub when `GITHUB_TOKEN` + PR number are present).

## Pipeline

1. Diff (`simple-git`)  
2. Semantic UIR — **Tree-sitter WASM** (Py/JS/TS/Java/Go/C#) with heuristic fallback  
3. Few-shot context from existing YAML (+ import hints)  
4. **LLM Gateway** → OpenAI-compatible `chat/completions` (`temperature: 0`)  
5. **Validate** — YAML → AJV (`natl.test.schema.json`) → `parseNatlDocument`  
6. **Self-healing** (optional) — on healable fail (`schema` / `step` / `parse`): repair prompt → LLM → re-validate, up to `self_healing.max_retries`; never commits invalid YAML  
7. Publish — `comment_provider` → GitHub PR comment / GitLab MR note / stdout (fail comments include healing history)  

### Self-healing

Opt-in via `self_healing.enabled`. Heals validate-gate errors only (not app code):

| Class | Source |
|-------|--------|
| `schema` | AJV / JSON Schema |
| `step` | `parseNatlDocument` / unknown steps |
| `parse` | Invalid YAML / non-mapping root |

Selector guidance (`data-testid`, role+name, text) is injected into system + repair prompts. Exhausted retries → gate still fails; PR comment lists attempt history.

## Programmatic API

```ts
import { runAgent, loadAgentConfig, createLlmClient } from '@natl/agent';

const config = loadAgentConfig({ cwd: process.cwd() });
const result = await runAgent({ config });
```

## Offline / private

Point `provider: ollama` (or `custom`) at a local server. No outbound LLM traffic; only local git + filesystem are required.

### Tiny model via npm (Transformers.js)

```bash
# once — creates gitignored ./local-llm/
node scripts/local-llm/setup.mjs
cd local-llm && npm start
# → http://127.0.0.1:8787/v1
```

Config: `examples/natl-agent.local-transformers.yml` or `tests/agent-release/natl-agent.local.yml`.

Pre-release suite: `tests/agent-release/` (`pnpm test`, `pnpm eval-gate`, `pnpm eval:live`).

### Live LLM eval

Sanitized PR-diff corpus (default **50** cases, no private PRs) → live LLM → `validateNatlYaml`.

```bash
cd tests/agent-release
pnpm eval:live:dry          # corpus + UIR smoke
# Reproducible ≥70% gate (fixture LLM, no weights):
node ../../scripts/local-llm/fixture-server.mjs   # terminal A → :8788
OPENAI_BASE_URL=http://127.0.0.1:8788/v1 OPENAI_MODEL=natl-fixture pnpm eval:live
# Real model (Ollama example):
#   OPENAI_BASE_URL=http://127.0.0.1:11434/v1 NATL_AGENT_PROVIDER=ollama OPENAI_MODEL=llama3.2 pnpm eval:live
```

Acceptance: validate pass rate ≥ **70%** (`LIVE_EVAL_TARGET`). Report `agent/eval/live-report.json` is gitignored; see `live-report.example.json`.

## Docker

```bash
cd agent
docker build -t natl-agent .
docker run --rm -e LLM_API_KEY -v "$PWD/..:/work" -w /work natl-agent --mode stdout --base origin/main
```

Optional Compose (Ollama + agent profile): see `docker-compose.yml`.

## Eval (DoD ≥70% validate gate)

```bash
cd agent
pnpm eval
# writes eval/report.json — synthetic 100 candidates, no live LLM
```

Live corpus eval (optional, needs LLM): `cd ../tests/agent-release && pnpm eval:live` → `agent/eval/live-report.json`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Missing API key | Set `LLM_API_KEY` or use `provider: ollama` |
| Empty UIR / no tests | Diff has no supported language files; check `--base` |
| Validation exit 2 | Model YAML failed AJV/`parseNatlDocument` — see PR comment; enable `self_healing` to auto-retry |
| Tree-sitter load fail | Heuristic fallback kicks in automatically |
