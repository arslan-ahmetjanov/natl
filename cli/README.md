<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/cli/brand/natl-lockup.png" alt="NATL — YAML test runner" width="360" />
</p>

# @natl/cli

CLI for **NATL** — YAML scenarios for **web UI + API**.

One compact scenario (and optional POM) for QA, developers, and DevOps. Swap the UI adapter (`engine:`) when the team’s stack changes; browser matrix is whatever that adapter supports. Stands and data differ via config / `--env` / vars — not by rewriting steps.

Logo assets: [`brand/`](./brand/).

## Getting Started

### 1. Install

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version
```

### 2. Scaffold a project

```bash
mkdir my-tests && cd my-tests
natl init
```

Creates `natl.config.yaml`, `tests/example.yaml`, `.env.example`, `.gitignore`, and a short README.
The example smoke hits the live [docs sandbox](https://natl-dev.github.io/natl/sandbox.html)
(`demo@natl.dev` / `secret`). Existing files are left alone unless you pass `--force`.

Alternatively, copy a YAML scenario from the `examples/` folder of the NATL repos into `tests/`.

### 3. Run

```bash
natl run tests/
natl run tests/ --tags smoke
natl run tests/ --grep Login
natl run tests/ --retries 2
natl run tests/ --workers 2
natl run tests/login.yaml --no-screenshot
natl validate tests/
natl engines
```

### Tags and grep

Mark scenarios with `tags` and select a subset in CI:

```yaml
name: Login smoke
tags: [smoke, auth]
```

```bash
natl run tests/ --tags smoke           # OR match: any of the CSV tags
natl run tests/ --tags smoke,auth
natl run tests/ --grep "Login"         # RegExp on scenario name or file path
natl run tests/ --tags smoke --grep API
```

If no tests match the filter, NATL prints a clear message and exits with code **1**.

### Parallel files (`--workers`)

By default NATL runs scenario **files** one after another (`--workers 1`). Use `--workers N` (or `workers` in `natl.config.yaml`) to run up to N files concurrently — each file gets its own browser/session.

```bash
natl run tests/ --workers 2
```

This is not the same as YAML `parallel:` (steps inside one scenario). Console PASS/FAIL lines may appear out of order when `workers > 1`; JUnit/JSON/Allure summaries still count every result. Failure screenshots/traces share `artifacts_dir` but use unique timestamped names, so collisions are unlikely.

### Fail-fast, max-failures, shard

Stop a large suite early, or split it across CI jobs:

```bash
natl run tests/ --fail-fast
natl run tests/ --max-failures 3
natl run tests/ --shard 1/2
natl run tests/ --shard 2/2 --workers 2
```

| Flag | Behavior |
|------|----------|
| `--fail-fast` | After the first **failed file** (retries included), do not start more files |
| `--max-failures <n>` | After **N failed tests** (cases count separately), stop starting files |
| `--shard <i>/<n>` | Deterministic slice of the filtered file list (`i` is 1-based). Shards `1/n`…`n/n` partition the suite without overlap |

In-flight files still finish and report when a stop triggers (compatible with `--workers`). Exit code is ≠ 0 if any completed test failed.

GitHub Actions matrix example:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1/2, 2/2]
steps:
  - run: natl run tests/ --shard ${{ matrix.shard }} --reporter junit --output artifacts/junit-${{ strategy.job-index }}.xml
```

### Retries

Re-run a failed scenario from the start (fresh browser) instead of re-running manually:

```yaml
name: Flaky checkout
retries: 1
```

```bash
natl run tests/ --retries 2
```

`retries` is the number of **extra** attempts after the first. Priority: `--retries` → test YAML → `natl.config` → `0`. Final status is last attempt wins; console/JSON show the attempt, and JSON may set `flaky: true` when a later attempt passes after a failure.

JUnit (`--reporter junit`) keeps **one** `<testcase>` per scenario (final status — safe for dorny/GitLab). When `attempts > 1` it also writes machine-readable `<property name="attempt|attempts|flaky"/>` (same fields as JSON) and keeps a short `<system-out>` line. Pass-after-retry adds a Surefire-style empty `<flakyFailure message="passed after retry …"/>` marker (ignored by parsers that do not understand it).

On failure NATL prints a `FAIL file:line step — reason` line and saves a screenshot under `artifacts/` next to the scenario (unless `--no-screenshot`). Soft asserts (`assert` + `soft: true`; alias `soft_assert`) continue the scenario; failures are summarized at the end (exit ≠ 0). Optional `--soft-assert-screenshot` (or `soft_assert_screenshot` in config) captures a shot per soft fail. With the default `--trace on-fail`, a Playwright trace `.zip` is written there too (open with `npx playwright show-trace <file>`). Optional `--video on-fail` (or `on`) saves a `.webm`. Trace/video save failures are warnings only. With retries configured, artifact names include `-attempt-N`.

```bash
natl run tests/ --trace on-fail
natl run tests/ --trace off
natl run tests/ --video on-fail
```

### 4. Secrets (`.env` + CI)

Supported backends: **process environment** and optional **dotenv** files. There is no built-in Vault or AWS Secrets Manager — fetch there in CI/CD (or a wrapper script) and export plain env vars before `natl run`.

**Local:** copy `.env.example` to `.env` (gitignored by the init template):

```bash
cp .env.example .env
```

```env
TEST_USER=qa@example.com
TEST_PASS=secret
```

**CI (GitHub Actions):** map repository secrets into the job `env:` block — same keys work as `$env.KEY` / `$secret.KEY`:

```yaml
- run: natl run tests/
  env:
    TEST_USER: ${{ secrets.TEST_USER }}
    TEST_PASS: ${{ secrets.TEST_PASS }}
```

Use them in YAML with `$env.KEY` / `$secret.KEY` (preferred) or `${ENV:KEY}` (compat):

```yaml
secrets:
  env:
    file: .env

steps:
  - fill: "#email"
    with: $env.TEST_USER
  - fill: "#password"
    with: $secret.TEST_PASS
```

NATL loads `.env` from the process working directory (and from a path declared under `secrets.env` in the scenario). Values read via `$env` / `$secret` / `${ENV:}` are masked as `***` in failure messages. Do not commit real credentials. Refs like `${VAULT:…}` / `${AWS:…}` fail with a clear error.

### Reporters

Default reporter is `console` (PASS/FAIL on stdout). For CI, add JUnit, JSON, and/or Allure:

```bash
natl run tests/ --reporter junit --output artifacts/junit.xml
natl run tests/ --reporter json --output artifacts/report.json
natl run tests/ --reporter console --reporter junit --output artifacts/junit.xml
natl run tests/ --reporter console --reporter allure --output allure-results
```

| Reporter | Output |
|----------|--------|
| `console` | stdout (default) |
| `junit` | XML (`artifacts/junit.xml` if `--output` omitted). Retry/flaky: properties `attempt` / `attempts` / `flaky` + optional `<flakyFailure>` |
| `json` | `{ results, summary }` (`artifacts/report.json` if omitted) |
| `allure` | Allure 2 results dir (`allure-results` if `--output` omitted) |

JSON `results[]` entries: `name`, `ok`, `durationMs`, `error`, `path`, and optionally `attempt`, `attempts`, `flaky`, `tags`, `engine`, `attachments` (`[{ name, path, type }]` for screenshot/trace/video when present), `steps`. Repeat `--reporter` to combine. If both `junit` and `json` share one `--output`, treat it as a directory and write `junit.xml` + `report.json` inside. With `allure` plus file reporters and a shared directory `--output`, Allure writes under `<output>/allure-results`.

Generate an HTML report from Allure results (requires the [Allure CLI](https://allurereport.org/docs/install/)):

```bash
npx allure generate allure-results -o allure-report --clean
```

### Project config

Optional `natl.config.yaml` (or `.yml`) next to your tests sets shared defaults (`engine`, `timeout`, `base_url`, `headless`, `artifacts_dir`, `retries`, `workers`, `trace`, `video`). NATL walks up from the scenario file to find it. `--engine`, `--headed`, `--retries`, `--workers`, `--trace`, and `--video` override the config.

Env profiles: put stand-specific overrides in `config/<name>.yaml` and run `natl run tests/ --env staging` (or `--config path/to/overlay.yaml`). Same scenarios, different stands — no step rewrites. Merge order: CLI → test YAML → env profile → base config → defaults. Without `--env` / `--config`, behavior is unchanged.

### IDE autocomplete

Install the [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension (VS Code / Cursor). After `npm install @natl/core` (or the CLI, which depends on it), add to `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "./node_modules/@natl/core/schemas/natl.config.schema.json": [
      "natl.config.yaml",
      "natl.config.yml",
      "config/*.yaml",
      "config/*.yml"
    ],
    "./node_modules/@natl/core/schemas/natl.test.schema.json": [
      "tests/**/*.yaml",
      "tests/**/*.yml"
    ]
  }
}
```

Invalid values such as `engine: foo` are underlined. The test schema validates **compact primary** (sibling keys / string forms), for example:

```yaml
- fill: "#email"
  with: $user
- wait: ".dashboard visible"
- assert: ".welcome"
  text: "Hello"
```

Same-line one-liners (`fill: "#x" with: $y`) still run via the preprocessor but are invalid YAML for the IDE — use the sibling/string form in files you want schema-checked. In JetBrains IDEs, map the same files under JSON Schema mappings.

## CI (GitHub Actions)

Copy the workflow below into `.github/workflows/natl.yml` in your project (same file ships under `examples/.github/workflows/natl.yml`). Assumes tests live under `tests/` after `natl init`.

Shared `--output artifacts` with both `junit` and `allure` writes:

- `artifacts/junit.xml`
- `artifacts/allure-results/` (Allure 2 raw results — upload this folder; generate HTML locally or in a follow-up step)

### CI with Allure

```bash
# raw results only (fast CI artifact)
natl run tests/ --reporter junit --reporter allure --output artifacts

# HTML report (Allure CLI on the runner or your machine)
npx allure generate artifacts/allure-results -o allure-report --clean
```

```yaml
name: NATL

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/2, 2/2]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm i -g @natl/cli @natl/adapter-playwright
      - run: npx playwright install --with-deps chromium
      - run: >
          natl run tests/
          --shard ${{ matrix.shard }}
          --reporter junit
          --reporter allure
          --output artifacts
        env:
          # Inject CI secrets as process env → $env.KEY / $secret.KEY
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASS: ${{ secrets.TEST_PASS }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: natl-artifacts-${{ strategy.job-index }}
          path: |
            artifacts/junit.xml
            artifacts/allure-results/

      # optional: Allure HTML
      # - run: npx allure generate artifacts/allure-results -o allure-report --clean
      #   if: always()
      # - uses: actions/upload-artifact@v4
      #   if: always()
      #   with:
      #     name: allure-report-${{ strategy.job-index }}
      #     path: allure-report/

      # optional: publish test results from artifacts/junit.xml
      # - uses: dorny/test-reporter@v1
      #   if: always()
      #   with:
      #     name: NATL
      #     path: artifacts/junit.xml
      #     reporter: java-junit
```

## Develop

```bash
pnpm install
pnpm build
pnpm test
node dist/index.js --help
```

For local work against sibling checkouts of `@natl/core` and `@natl/adapter-playwright`:

```bash
# from each sibling package
pnpm link --global

# from this repo
pnpm link --global @natl/core
pnpm link --global @natl/adapter-playwright
pnpm install
pnpm build
```

Or use pnpm overrides:

```json
{
  "pnpm": {
    "overrides": {
      "@natl/core": "link:../core",
      "@natl/adapter-playwright": "link:../adapter-playwright"
    }
  }
}
```

Engine adapters are loaded dynamically (not bundled into the language core). Same YAML, different `engine:` when more adapters ship.

| `engine:` / `--engine` | Package | Browsers |
|------------------------|---------|----------|
| `playwright` | `@natl/adapter-playwright` | chromium / firefox / webkit (Playwright) |
| `selenium` | `@natl/adapter-selenium` | chrome / firefox / edge (Selenium Manager; optional `SELENIUM_REMOTE_URL`) |
| `cypress` | `@natl/adapter-cypress` | chrome / electron / edge / firefox — **experimental** MVP (peer `cypress`; no gesture/trace parity) |
| `http` | built-in (`@natl/core`) | n/a (API only) |

```bash
natl run suite.yaml --engine myengine --engine-package @acme/natl-adapter
```
