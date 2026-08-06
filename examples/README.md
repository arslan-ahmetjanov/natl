<p align="center">
  <img src="./brand/natl-lockup.svg" alt="NATL — YAML test runner" width="360" />
</p>

# NATL examples

Scenarios against the **docs sandbox** (local twin + live GitHub Pages): same steps, swap stands with `--env`, run under `@natl/cli` + `@natl/adapter-playwright`.

Logo assets: [`brand/`](./brand/).

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium

natl run login.yaml
natl run env_login.yaml
natl run pom_login.yaml
natl run data_driven.yaml
natl run e2e_sandbox.yaml
natl run env_profile_demo.yaml --env staging
natl run env_profile_demo.yaml --env prod   # live Pages (network)
natl run smoke_sandbox.yaml                 # live Pages login + API

# HTTP-only still uses the local echo stub:
node stubs/echo-server.mjs   # terminal 1 → :8765
natl run http_only.yaml
natl run ui_http_block.yaml  # sandbox UI + Pages JSON (+ UI ping)
```

Project defaults: [`natl.config.yaml`](./natl.config.yaml). Env overlays under [`config/`](./config/):
`--env staging` → `./fixtures/sandbox.html`, `--env prod` → live [sandbox](https://natl-dev.github.io/natl/sandbox.html).

Sandbox credentials: `demo@natl.dev` / `secret` (welcome text uses the email local-part).

GitHub Actions template: [`.github/workflows/natl.yml`](./.github/workflows/natl.yml).  
Agent on PR/MR (GitHub / GitLab / Jenkins): [`.github/workflows/natl-agent.yml`](./.github/workflows/natl-agent.yml), [`ci/`](./ci/).

| File | What it shows |
|------|----------------|
| `natl.config.yaml` | Shared defaults (`base_url` → local sandbox) |
| `config/staging.yaml` | Local sandbox twin |
| `config/prod.yaml` | Live Pages sandbox |
| `env_profile_demo.yaml` | `$base_url` from config / `--env` |
| `env_login.yaml` | `$env.*` / `$secret.*` from `.env` (CI: inject same keys in job `env:`) |
| `login.yaml` | Basic sandbox login |
| `pom_login.yaml` | Page Object via `do:` |
| `data_driven.yaml` | `cases:` welcome per user |
| `e2e_sandbox.yaml` | Login → API ping → logout → bad password |
| `smoke_sandbox.yaml` | Live Pages smoke (network) |
| `smoke_selenium.yaml` | Same idea via Selenium |
| `smoke_cypress.yaml` | Local sandbox via Cypress (**experimental**; not CI-gated) |
| `soft_assert_demo.yaml` | Soft asserts (+ `tap` alias) |
| `tap_smoke.yaml` | `tap:` = `click` |
| `http_only.yaml` | `engine: http` vs local stub |
| `ui_http_block.yaml` | Sandbox UI + `with: http` to sandbox JSON |
| `gestures_demo.yaml` | Gestures fixture (separate HTML) |
| `stubs/` | Local echo API (`node stubs/echo-server.mjs`) |
| `fixtures/sandbox.html` | Offline twin of the docs sandbox |
| `ci/` | GitLab CI + Jenkins templates for `@natl/agent` |
