# @natl/agent — pre-release feature suite

Проект в `tests/agent-release/` проверяет ключевые фичи агента **перед релизом**.

**Владелец процесса:** роль **Тестер** (`AGENTS.md` / `.cursor/rules/natl-tester.mdc`).  
Тестер прогоняет suite до DevOps и **дополняет покрытие**, если фича не покрыта.

## Что покрыто

| Фича | Тест |
|------|------|
| Unified diff parse | `features.test.ts` |
| Language detect + heuristic UIR | ✓ |
| Tree-sitter UIR (5 языков) | ✓ |
| Context / RAG + import hints | ✓ |
| Prompt / JSON→YAML extract (+ YAML fallback) | ✓ |
| Deterministic normalize (mega-step split, aliases) | ✓ |
| `natl-agent.yml` + LLM Gateway (mock fetch) | ✓ |
| Validate gate (AJV + parseNatlDocument) | ✓ |
| Pipeline end-to-end (llmOverride, no network) | ✓ |
| Self-healing (invalid → repaired valid; history) | ✓ |
| Comment publisher (GitHub / GitLab / auto→stdout) | ✓ |
| Eval gate ≥70% | `pnpm eval-gate` |
| Live corpus (50 sanitized diffs, no PII) | `live-corpus.test.ts` |
| Live LLM eval (validate rate + latency) | `pnpm eval:live` → `agent/eval/live-report.json` |
| Live local tiny LLM smoke (optional) | `pnpm test:live` |

## Setup

```bash
# 1) build agent + core
cd core && pnpm build
cd ../agent && pnpm build

# 2) install this suite
cd ../tests/agent-release
pnpm install

# 3) (optional) local tiny model runtime — каталог gitignored
#    node ../../scripts/local-llm/setup.mjs && cd ../../local-llm && npm start
```

## Run (обязательный gate Тестера)

```bash
cd tests/agent-release
pnpm test          # unit + pipeline (no live LLM)
pnpm eval-gate     # synthetic 100-case validate ≥70%
pnpm eval:live:dry # corpus tooling smoke (no LLM)
pnpm eval:live     # live LLM on sanitized corpus (default N=50, target ≥70%)
pnpm test:live     # single-repo smoke vs local-llm :8787
```

### Live eval (`pnpm eval:live`)

| Env / flag | Default | Meaning |
|------------|---------|---------|
| `LIVE_EVAL_N` | `50` | Corpus size (sanitized diffs) |
| `LIVE_EVAL_TARGET` | `0.70` | Min `validateNatlYaml` pass rate |
| `--dry` / `LIVE_EVAL_DRY=1` | off | Corpus + UIR only |
| `LIVE_EVAL_HEAL` | on | Self-healing repairs during eval |
| `OPENAI_BASE_URL` | `http://127.0.0.1:8787/v1` | LLM endpoint |
| `OPENAI_MODEL` / `NATL_AGENT_PROVIDER` | Qwen 0.5B / `custom` | Model + provider |

Report artifact: [`agent/eval/live-report.json`](../../agent/eval/live-report.json) (gitignored) — rate, p50/p95 latency, model, date, sample failures.

**Acceptance:** validate pass rate ≥ **70%** on the live corpus (same bar as synthetic gate).

| LLM | How | Notes |
|-----|-----|-------|
| Fixture (reproducible gate) | `node ../../scripts/local-llm/fixture-server.mjs` → `:8788` then `OPENAI_BASE_URL=http://127.0.0.1:8788/v1 OPENAI_MODEL=natl-fixture pnpm eval:live` | Deterministic valid YAML; CI-friendly |
| Tiny Transformers.js | `node ../../scripts/local-llm/setup.mjs` → `:8787` | Smoke / quality probe; may miss 70% |
| Ollama / cloud | set `OPENAI_BASE_URL` + `NATL_AGENT_PROVIDER` + model | Preferred for real quality tracking |

Example report shape: [`agent/eval/live-report.example.json`](../../agent/eval/live-report.example.json). Live runs write gitignored `agent/eval/live-report.json`.

Live test / eval skip automatically if the LLM endpoint is down (`test:live` skips; `eval:live` exits 2). Set `LOCAL_LLM=1` to force-fail `test:live` when down.

## Когда дополнять suite

- Новая фича в `agent/` без строки в таблице выше → добавить тест + обновить таблицу.
- Сломанный/устаревший сценарий → починить фикстуру, не ослаблять assert без причины.
- После правок — снова `pnpm test` (+ `eval-gate`) до зелёного, затем передача DevOps.
