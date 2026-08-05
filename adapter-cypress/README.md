<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/adapter-cypress/brand/natl-lockup.png" alt="NATL — YAML test runner" width="360" />
</p>

# @natl/adapter-cypress

**Experimental (MVP)** Cypress UI adapter for NATL.

Same compact YAML as other engines; set `engine: cypress`. **Not** the default and **not** prod-parity with Playwright. Prefer `@natl/adapter-playwright` for Getting Started / CI. Prefer `@natl/adapter-selenium` when you need classic WebDriver / Grid. Use this package only if your team is already invested in Cypress and accepts the ceiling below.

## Status

| | |
|--|--|
| Maturity | **Experimental MVP** |
| CI | Package `pnpm build` + unit tests only — **no e2e smoke** in GitHub Actions |
| Recommendation | Local / niche Cypress shops; not a drop-in Playwright replacement |

## Ceiling (honest matrix)

| Capability | Cypress adapter |
|------------|-----------------|
| Typical click / fill / assert | Yes (via command bridge) |
| Session start | Slow (spins Cypress + HTTP bridge) |
| `swipe` / `longPress` | **No** (throws) |
| Scroll by `deltaX`/`deltaY` | **No** (into-view only) |
| NATL `trace` / `video` / Trace Viewer | **No** (warns via `finalizeArtifacts`) |
| Fail screenshot → NATL `artifacts/` path | **Unreliable** (`cy.screenshot` name, not core path) |
| `viewport` factory opt | Ignored |
| Locators | `css`, `xpath` only |

## Approach

Cypress is not an external WebDriver session. This package:

1. Starts a local HTTP **command bridge**
2. Launches `cypress.run` (Module API) with a throwaway long-running spec
3. The spec polls commands via `cy.task` and executes `cy.visit` / `cy.get` / …

## Install

```bash
npm install @natl/core @natl/adapter-cypress cypress
npx cypress install
```

```bash
npm install -g @natl/cli @natl/adapter-cypress
natl run tests/ --engine cypress
```

Local smoke (optional, not gated in CI):

```bash
natl run examples/smoke_cypress.yaml --engine cypress --trace off --video off
```

## Config

```yaml
engine: cypress
browser: electron   # chrome (default) | electron | edge | firefox
headless: true
timeout: 15000
# Prefer: trace: off / video: off (unsupported; warns on fail otherwise)
```

## Develop

```bash
pnpm install
pnpm build
pnpm test
```

Peer: `@natl/core` + `cypress`. Local core: `pnpm link` / `link:../core`.

## Exports

| Export | Purpose |
|--------|---------|
| `engine` | `"cypress"` |
| `createAdapter` | `AdapterFactory` |
| `CypressAdapter` | Class |
| `resolveCypressBrowser` / `resolveCypressLocator` | Helpers |
| `CommandBridge` | HTTP bridge (advanced) |
