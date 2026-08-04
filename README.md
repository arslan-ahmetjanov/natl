<p align="center">
  <img src="brand/natl-lockup.svg" alt="NATL — YAML test runner" width="360" />
</p>

# NATL

**Not Another Testing Language** — an open-source **test runner**: YAML scenarios for **web UI and API**.

Write one compact scenario (optional POM). Run it locally or in CI. Keep it when the stack moves — swap `engine:` (`playwright` → `selenium` / `cypress`) without rewriting typical flows. Mix UI and HTTP in the same file.

<p>
  <a href="https://www.npmjs.com/package/@natl/cli"><img src="https://img.shields.io/npm/v/@natl%2Fcli.svg" alt="npm @natl/cli" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://arslan-ahmetjanov.github.io/natl/"><img src="https://img.shields.io/badge/docs-GitHub%20Pages-brightgreen.svg" alt="Docs" /></a>
</p>

## Why NATL

| | |
|--|--|
| **Compact language** | Compact YAML, `elements` / `actions` / `do:` |
| **Fullstack** | Web UI + API in one file (`with: http`) |
| **One scenario, many contexts** | Stands (`--env`), vars, `cases:` — not `if: mobile` in steps |
| **Portable via adapters** | Same YAML; browsers = what the adapter supports |
| **Honest ceiling** | Most smoke/regression ports; engine-specific edges are escape hatches |
| **Runner, not a TMS** | CLI runs tests — no dashboard product |

Built for **QA, developers, and DevOps**.

## Quick start

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version

mkdir my-tests && cd my-tests
natl init
natl run tests/
```

Or try the demos in [`examples/`](./examples/).

## Documentation

Site (EN / RU / 中文 / ES · light & dark): **https://arslan-ahmetjanov.github.io/natl/**  
Start with the [guide](https://arslan-ahmetjanov.github.io/natl/getting-started.html) — install first, then every language block on one page.

## Packages

| Package | Role |
|---------|------|
| [`@natl/core`](./core/) | Language, interpreter, `EngineAdapter` contract, reporters |
| [`@natl/adapter-playwright`](./adapter-playwright/) | Default UI engine |
| [`@natl/adapter-selenium`](./adapter-selenium/) | Selenium WebDriver |
| [`@natl/adapter-cypress`](./adapter-cypress/) | Cypress (command-bridge MVP) |
| [`@natl/cli`](./cli/) | `natl` CLI |

Same YAML — different `engine:` (`playwright` / `selenium` / `cypress` / `http`).

## Example

```yaml
name: Login smoke
engine: playwright
tags: [smoke]

vars:
  base_url: ./fixtures/shop.html
  user: demo@test.com
  pass: secret

steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - fill: "#password"
    with: $pass
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Добро пожаловать"
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](./LICENSE)
