# Contributing to NATL

NATL is an open-source monorepo. Publishable packages: `core` → adapters → `cli`.

## Develop

```bash
cd core && pnpm install && pnpm build && pnpm test
cd ../adapter-playwright && pnpm install && pnpm build && pnpm test
cd ../cli && pnpm install && pnpm build && node dist/index.js --version
```

Local linking: `pnpm link` or `pnpm.overrides` with `link:../…` — never `file:` in publishable `dependencies`.

## Pull requests

- One concern per PR; TypeScript `strict`, ESM (`type: module`).
- Changes to `EngineAdapter` / public core API: update adapter(s) and CLI in the same PR.
- Do not commit `.env`, `token.md`, or `.npmrc` with `_authToken`.

## Documentation

Site source: [`docs/`](./docs/) (published via GitHub Pages).  
Keep package READMEs short; put deep guides in `docs/`.

## Code of conduct

Be respectful. Default to assuming good intent in reviews.
