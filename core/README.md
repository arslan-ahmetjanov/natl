<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/core/brand/natl-lockup.png" alt="NATL — YAML test runner" width="360" />
</p>

# @natl/core

Language runtime for **NATL** — a YAML DSL for **web UI + API** scenarios.

Write compact steps once (plus optional POM). UI engines plug in via `EngineAdapter`; browsers and driver features are whatever the chosen adapter supports. Typical flows stay portable across adapters; engine-specific edges are an escape hatch, not the happy path.

Logo assets: [`brand/`](./brand/).

- YAML / compact-step parser → AST
- Expression engine (`$vars`, `$env.*` / `$secret.*`, `${ENV:…}` compat, builtins)
- Interpreter (flow + actions + HTTP)
- `EngineAdapter` v2 for UI engines; built-in `http` engine for API steps (`with: http` / `engine: http`)
- Built-in `api:` steps (compat; growth moves to `engine: http`)
- Reporters (`console` / `junit` / `json`) for CI

## Install

```bash
npm install @natl/core
```

End users usually install [`@natl/cli`](https://www.npmjs.com/package/@natl/cli) + an adapter instead of depending on core directly.

## Develop

```bash
pnpm install
pnpm build
pnpm test
```

To exercise unpublished local changes from a sibling package (`adapter-playwright`, `cli`):

```bash
# from this repo
pnpm link --global

# from the sibling repo
pnpm link --global @natl/core
```

Or pin a local path with pnpm overrides in the consumer `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "@natl/core": "link:../core"
    }
  }
}
```

## JSON Schema (IDE)

Schemas ship in this package under `schemas/`:

- `schemas/natl.config.schema.json` — `natl.config.yaml` and `config/<env>.yaml`
- `schemas/natl.test.schema.json` — scenario YAML (**compact primary**: sibling keys / string forms; nested objects = advanced)

See [@natl/cli README](https://www.npmjs.com/package/@natl/cli) → **IDE autocomplete** for the `yaml.schemas` snippet.

## Docs

- [Canon](docs/canon.md) — fullstack web+API principles, ~90% vocabulary, acceptance filter for new verbs
- [Syntax](docs/syntax.md) — language surface (how-to)
- [Architecture](docs/architecture.md) — core vs adapters vs CLI
