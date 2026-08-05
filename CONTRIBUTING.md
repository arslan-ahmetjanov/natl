# Contributing to NATL

NATL is an open-source monorepo. Publishable packages: `core` → adapters → `cli`.

## Develop

```bash
cd core && pnpm install && pnpm build && pnpm test
cd ../adapter-playwright && pnpm install && pnpm build && pnpm test
cd ../cli && pnpm install && pnpm build && node dist/index.js --version
```

Local linking: `pnpm link` or `pnpm.overrides` with `link:../…` — never `file:` in publishable `dependencies`.

## CI

Root workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

| Job | What |
|-----|------|
| `core` / `adapter-*` / `cli` | Package build + unit tests (Cypress: build+unit only, no e2e) |
| `smoke` | Real `natl run` against **offline** `examples/fixtures/sandbox.html` via `examples/login.yaml` |

The smoke job builds linked local packages, installs Chromium, runs Playwright headless with `trace`/`video` off, writes JUnit under `examples/artifacts/`, and uploads that folder on failure. It must stay green for a healthy happy-path; prefer this offline fixture over the live Pages URL (`smoke_sandbox.yaml`) to avoid network flakes.

Local equivalent:

```bash
cd core && pnpm install && pnpm build
cd ../adapter-playwright && pnpm install && pnpm build && npx playwright install chromium
cd ../cli && pnpm install && pnpm build
cd ../examples && node ../cli/dist/index.js run login.yaml --trace off --video off
```

## Pull requests

- One concern per PR; TypeScript `strict`, ESM (`type: module`).
- Changes to `EngineAdapter` / public core API: update adapter(s) and CLI in the same PR.
- Do not commit `.env`, `token.md`, or `.npmrc` with `_authToken`.

## Documentation

Site source: [`docs/`](./docs/) (published via GitHub Pages).  
Keep package READMEs short; put deep guides in `docs/`.

## Code of conduct

Be respectful. Default to assuming good intent in reviews.
