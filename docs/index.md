# NATL documentation

**NATL** (*Not Another Testing Language*) is an open-source, short YAML runner for **web UI and API** tests.

Write compact scenarios once. Run them with the CLI. Drive the browser through an **adapter** (Playwright by default; Selenium and Cypress available). Mix UI and HTTP in one file.

## Guides

| Page | Contents |
|------|----------|
| [Getting started](getting-started.md) | Install, `natl init`, first green run |
| [Syntax](syntax.md) | Language surface (how-to) |
| [Canon](canon.md) | Principles, ~90% vocabulary, scope |
| [Architecture](architecture.md) | Core, adapters, CLI |
| [Adapters](adapters.md) | Playwright, Selenium, Cypress, HTTP |

## Install

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version
```

## Links

- [GitHub repository](https://github.com/arslan-ahmetjanov/natl)
- [npm `@natl/cli`](https://www.npmjs.com/package/@natl/cli)
- [Examples](https://github.com/arslan-ahmetjanov/natl/tree/main/examples)
- [Contributing](https://github.com/arslan-ahmetjanov/natl/blob/main/CONTRIBUTING.md)
- License: [MIT](https://github.com/arslan-ahmetjanov/natl/blob/main/LICENSE)
