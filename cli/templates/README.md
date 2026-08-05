# NATL tests

YAML scenarios for **web UI + API**. Default example hits the
[docs sandbox](https://arslan-ahmetjanov.github.io/natl/sandbox.html)
(`natl init` sets `base_url` there).

## How to run

```bash
npm install @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl run tests/
natl run tests/ --tags smoke
natl run tests/ --workers 2
natl run tests/ --reporter junit --output artifacts/junit.xml
natl run tests/ --reporter console --reporter allure --output allure-results
```

Offline: clone [natl](https://github.com/arslan-ahmetjanov/natl) and set
`base_url` in `natl.config.yaml` to `examples/fixtures/sandbox.html`.

Copy `.env.example` to `.env` when a scenario needs secrets (or inject the same keys in CI `env:` — Vault/AWS are not built into NATL).

CI: copy [`examples/.github/workflows/natl.yml`](https://github.com/arslan-ahmetjanov/natl/blob/main/examples/.github/workflows/natl.yml)
for sharded runs with JUnit + Allure artifacts.
