# Getting started

## Requirements

- Node.js **18+**
- npm (or a compatible client)
- For UI tests: a browser for your adapter (Chromium via Playwright is the default path)

## Install

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version
```

## Scaffold a project

```bash
mkdir my-tests && cd my-tests
natl init
natl run tests/
```

`natl init` creates `natl.config.yaml`, `tests/example.yaml`, `.env.example`, `.gitignore`, and a short README. Existing files are left alone unless you pass `--force`.

## Run examples from this repo

```bash
git clone https://github.com/arslan-ahmetjanov/natl.git
cd natl/examples
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl run login.yaml
```

HTTP demos need the local stub:

```bash
node stubs/echo-server.mjs   # terminal 1 — http://127.0.0.1:8765
natl run http_only.yaml      # terminal 2
natl run ui_http_block.yaml
```

## Useful commands

```bash
natl run tests/
natl run tests/ --tags smoke
natl run tests/ --grep Login
natl run tests/ --retries 2
natl validate tests/
natl engines
```

On failure NATL prints `FAIL file:line step — reason`, saves a screenshot under `artifacts/` (unless `--no-screenshot`), and can write Playwright trace/video.

## IDE autocomplete

Install the [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension, then map schemas from `@natl/core`:

```json
{
  "yaml.schemas": {
    "./node_modules/@natl/core/schemas/natl.config.schema.json": [
      "natl.config.yaml",
      "natl.config.yml",
      "config/*.yaml"
    ],
    "./node_modules/@natl/core/schemas/natl.test.schema.json": [
      "tests/**/*.yaml",
      "tests/**/*.yml"
    ]
  }
}
```

## Next

- [Syntax](syntax.md) — compact steps, POM, cases, HTTP blocks  
- [Adapters](adapters.md) — engines and browsers  
- [Canon](canon.md) — what belongs in the language
