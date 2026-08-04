<p align="center">
  <img src="./brand/natl-lockup.svg" alt="NATL — YAML test runner" width="360" />
</p>

# NATL examples

Demo scenarios for the **web UI + API** YAML language: same steps, swap stands with `--env`, run under `@natl/cli` + `@natl/adapter-playwright`.

Logo assets: [`brand/`](./brand/).

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium

natl run login.yaml
natl run env_login.yaml
natl run pom_login.yaml
natl run data_driven.yaml
natl run e2e_shop.yaml
natl run env_profile_demo.yaml --env staging

# HTTP examples need the local stub (not httpbin):
node stubs/echo-server.mjs   # terminal 1 → :8765
natl run http_only.yaml
natl run ui_http_block.yaml
```

Project defaults live in [`natl.config.yaml`](./natl.config.yaml) (`engine`, `timeout`, `base_url`, …). Env overlays under [`config/`](./config/) (`--env staging` → local shop fixture, `--env prod` → `https://example.com`) — **one scenario, different stands**. CLI flags override them.

GitHub Actions: copy [`.github/workflows/natl.yml`](./.github/workflows/natl.yml) into your project (see also `@natl/cli` README → CI).

| File | What it shows |
|------|----------------|
| `natl.config.yaml` | Shared project defaults |
| `config/staging.yaml` | Env profile (`--env staging`) |
| `config/prod.yaml` | Env profile (`--env prod`) |
| `env_profile_demo.yaml` | `$base_url` from config / `--env` |
| `env_login.yaml` | `$env.*` / `$secret.*` from `.env` |
| `login.yaml` | Basic UI flow (compact) |
| `pom_login.yaml` | Page Object via `do:` |
| `data_driven.yaml` | `cases:` data-driven |
| `e2e_shop.yaml` | Longer scenario + screenshot |
| `smoke_example_com.yaml` | Live smoke (needs network) |
| `smoke_selenium.yaml` | Same idea via `--engine selenium` / `engine: selenium` |
| `smoke_cypress.yaml` | Local fixture via Cypress adapter (peer `cypress`) |
| `soft_assert_demo.yaml` | Soft asserts (+ `tap` alias) |
| `tap_smoke.yaml` | `tap:` = `click` |
| `http_only.yaml` | `engine: http` vs local stub (`stubs/`) |
| `ui_http_block.yaml` | UI + `with: http` vs local stub |
| `stubs/` | Local echo API (`node stubs/echo-server.mjs`) |
