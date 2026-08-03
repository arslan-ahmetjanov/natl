<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/cli/brand/natl-lockup.png" alt="NATL — Not Another Testing Language" width="360" />
</p>

# @natl/cli

CLI for **NATL** — short fullstack YAML scenarios for **web UI + API**.

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

Creates `natl.config.yaml`, `tests/example.yaml`, `.env.example`, `.gitignore`, and a short README. Existing files are left alone unless you pass `--force`.

Alternatively, copy a YAML scenario from the `examples/` folder of the NATL repos into `tests/`.

### 3. Run

```bash
natl run tests/
natl run tests/ --tags smoke
natl run tests/ --grep Login
natl run tests/ --retries 2
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

On failure NATL prints a `FAIL file:line step — reason` line and saves a screenshot under `artifacts/` next to the scenario (unless `--no-screenshot`). Soft asserts (`assert` + `soft: true`; alias `soft_assert`) continue the scenario; failures are summarized at the end (exit ≠ 0). Optional `--soft-assert-screenshot` (or `soft_assert_screenshot` in config) captures a shot per soft fail. With the default `--trace on-fail`, a Playwright trace `.zip` is written there too (open with `npx playwright show-trace <file>`). Optional `--video on-fail` (or `on`) saves a `.webm`. Trace/video save failures are warnings only. With retries configured, artifact names include `-attempt-N`.

```bash
natl run tests/ --trace on-fail
natl run tests/ --trace off
natl run tests/ --video on-fail
```

### 4. Secrets via `.env`

Copy `.env.example` to `.env` and fill in values (`.env` is gitignored by the init template):

```bash
cp .env.example .env
```

```env
TEST_USER=qa@example.com
TEST_PASS=secret
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

NATL loads `.env` from the process working directory (and from a path declared under `secrets.env` in the scenario). Do not commit real credentials.

### Reporters

Default reporter is `console` (PASS/FAIL on stdout). For CI, add JUnit and/or JSON:

```bash
natl run tests/ --reporter junit --output artifacts/junit.xml
natl run tests/ --reporter json --output artifacts/report.json
natl run tests/ --reporter console --reporter junit --output artifacts/junit.xml
```

| Reporter | Output |
|----------|--------|
| `console` | stdout (default) |
| `junit` | XML (`artifacts/junit.xml` if `--output` omitted) |
| `json` | `{ results, summary }` (`artifacts/report.json` if omitted) |

JSON `results[]` entries: `name`, `ok`, `durationMs`, `error`, `path`, and optionally `attempt`, `attempts`, `flaky`. Repeat `--reporter` to combine. If both `junit` and `json` share one `--output`, treat it as a directory and write `junit.xml` + `report.json` inside.

### Project config

Optional `natl.config.yaml` (or `.yml`) next to your tests sets shared defaults (`engine`, `timeout`, `base_url`, `headless`, `artifacts_dir`, `retries`, `trace`, `video`). NATL walks up from the scenario file to find it. `--engine`, `--headed`, `--retries`, `--trace`, and `--video` override the config.

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

Copy the workflow below into `.github/workflows/natl.yml` in your project (same file ships in the repo under `examples/.github/workflows/natl.yml`). Assumes tests live under `tests/` after `natl init`.

```yaml
name: NATL

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm i -g @natl/cli @natl/adapter-playwright
      - run: npx playwright install --with-deps chromium
      - run: natl run tests/ --reporter junit --output artifacts/junit.xml
        env:
          # optional: map GitHub secrets into ${ENV:…} for scenarios
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASS: ${{ secrets.TEST_PASS }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: natl-artifacts
          path: artifacts/

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
| `cypress` | `@natl/adapter-cypress` | chrome / electron / edge / firefox (peer `cypress`) |
| `http` | built-in (`@natl/core`) | n/a (API only) |

```bash
natl run suite.yaml --engine myengine --engine-package @acme/natl-adapter
```
