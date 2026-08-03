<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/adapter-cypress/brand/natl-lockup.png" alt="NATL — Not Another Testing Language" width="360" />
</p>

# @natl/adapter-cypress

Official **Cypress** UI adapter for NATL (MVP).

Same compact YAML as other engines; set `engine: cypress`. **Not** the default — prefer Playwright for Getting Started. Selenium ([`@natl/adapter-selenium`](https://www.npmjs.com/package/@natl/adapter-selenium)) is usually a better second engine when you need a classic WebDriver.

## MVP approach

Cypress is not an external WebDriver session. This package:

1. Starts a local HTTP **command bridge**
2. Launches `cypress.run` (Module API) with a throwaway long-running spec
3. The spec polls commands via `cy.task` and executes `cy.visit` / `cy.get` / …

**Limits vs Playwright:** slower session start; no NATL trace/video; `swipe` / `longPress` unsupported; scroll is into-view only.

## Install

```bash
npm install @natl/core @natl/adapter-cypress cypress
npx cypress install
```

```bash
npm install -g @natl/cli @natl/adapter-cypress
natl run tests/ --engine cypress
```

## Config

```yaml
engine: cypress
browser: electron   # chrome (default) | electron | edge | firefox
headless: true
timeout: 15000
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
