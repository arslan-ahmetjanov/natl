# Changelog

## Unreleased

### Docs / course

- **Agent page** on the site (`docs/agent.html` + i18n en/ru/zh/es): setup, local run, GitHub Actions / GitLab / Jenkins, generate-then-run flow
- **Course module 6** in `courses/01_NATL_avtotesty_UI_i_API`: `@natl/agent` from scratch (roles, config, CI)

### `@natl/agent` (0.1.0 local / npm)

Agent MVP 2.0 (API-first) — generate NATL YAML from git diffs via OpenAI-compatible LLM.

- **Tree-sitter UIR** — semantic diff for Py/JS/TS/Java/Go/C# (WASM + heuristic fallback), import hints in RAG
- **LLM Gateway** — `openai` / `ollama` / `azure` / `custom`, `natl-agent.yml`, `temperature` forced to `0`
- **Validate gate** — AJV (`natl.test.schema.json`) + `parseNatlDocument` (same bar as `natl validate`); synthetic eval ≥70%
- **Packaging** — Dockerfile/compose, GitHub Action, examples
- **Self-healing** — optional retry after validate fail (`self_healing.enabled` / `max_retries`), selector hints, heal history in PR comments; invalid YAML never committed
- **CI beyond GitHub** — `comment_provider`: `auto` | `github` | `gitlab` | `stdout`; GitLab MR Notes API; examples: `examples/ci/gitlab-ci.yml`, `examples/ci/Jenkinsfile`
- **Live LLM eval** — sanitized corpus N=50 (`pnpm eval:live` / `--dry`); report `agent/eval/live-report.json` (gitignored; see `live-report.example.json`); fixture LLM on `:8788` for reproducible ≥70% gate; `scripts/local-llm/`
- **JSON→YAML generation** — prompt asks for schema-shaped JSON; convert via `yaml.stringify`; OpenAI/Azure `response_format: json_object` (`llm.json_mode`); YAML replies still accepted as fallback
- **Deterministic normalize** — before validate: split multi-verb mega-steps, expand aliases (`fill+with`, …), move top-level `assertions`, infer `engine`; LLM `self_healing` remains optional second pass; model recommendations in `agent/README.md`

Pre-release suite: `tests/agent-release/` (`pnpm test`, `pnpm eval-gate`, `pnpm eval:live`, `pnpm test:live`).

## 1.0.0

Public API freeze for production pilots. See [`core/docs/api-1.0.md`](./core/docs/api-1.0.md).

### Compatible with 0.1.x

- Pilot YAML / CLI flags from **0.1.5–0.1.7** keep working on Playwright
- No forced rewrite of scenarios for the upgrade

### Highlights carried from 0.1.6–0.1.7

- Reporters: Allure, JUnit flaky properties, enriched JSON
- Suite: `--workers`, `--fail-fast`, `--max-failures`, `--shard`
- Secrets: process env + dotenv only (no Vault/AWS in-core)
- Root CI offline smoke; consumer workflow with JUnit + Allure artifacts
- Adapter status: Playwright supported; Selenium supported-with-limits; Cypress experimental

### Deprecated (still work)

- `api:` steps → prefer HTTP verbs / `with: http` / `engine: http`
- `${ENV:KEY}` → prefer `$env.KEY` / `$secret.KEY`

### Breaking vs pre-1.0 expectations (docs only)

- Vault/AWS are **not** in-core (never were functional; stubs removed)
- Cypress is **not** covered by the 1.0 stability promise

## 0.1.7

Prod-pilot packaging: workers/shard/fail-fast, Allure, secrets B, JUnit flaky metadata, root CI smoke, docs.

## 0.1.6

Allure reporter + reporter enrichment (tags/attachments/engine).

## 0.1.5 and earlier

Initial public npm packages (Playwright path, junit/json, retries, tags/grep, trace/video).
