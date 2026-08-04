<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/adapter-playwright/brand/natl-lockup.png" alt="NATL — YAML test runner" width="360" />
</p>

# @natl/adapter-playwright

Official **Playwright** UI adapter for NATL.

NATL scenarios stay in compact YAML; this package is the default `EngineAdapter` implementation. Browser choice (`chromium` / `firefox` / `webkit`) is a **capability of this adapter** — set via `browser:` in `natl.config` (opaque string to `@natl/core`). Other adapters (Selenium, Cypress — planned) can run the same typical scenarios with `engine:` swapped.

Logo assets: [`brand/`](./brand/).

## Install

```bash
npm install @natl/core @natl/adapter-playwright
npx playwright install chromium
# optional: firefox / webkit — see Playwright docs
```

Use with the CLI:

```bash
npm install -g @natl/cli @natl/adapter-playwright
natl run tests/ --engine playwright
```

## Config (factory opts)

```yaml
# natl.config.yaml
engine: playwright
browser: firefox          # chromium | firefox | webkit (this adapter)
headless: true
viewport:                 # optional session hint
  width: 390
  height: 844
timeout: 15000
trace: on-fail
video: off
```

Unknown `browser` values throw a clear error (no silent fallback to Chromium).

## Develop

```bash
pnpm install
pnpm build
```

`@natl/core` is a peer dependency (`^0.1.0`). For local work against a sibling checkout:

```bash
# from ../core
pnpm link --global

# from this repo
pnpm link --global @natl/core
pnpm install
pnpm build
```

Or use pnpm overrides:

```json
{
  "pnpm": {
    "overrides": {
      "@natl/core": "link:../core"
    }
  }
}
```

## Exports

| Export | Purpose |
|--------|---------|
| `engine` | `"playwright"` |
| `createAdapter` | `AdapterFactory` (`timeout`, `headless`, `browser`, `viewport`, `trace`, `video`) |
| `PlaywrightAdapter` | Class |
| `resolvePlaywrightBrowser` | Map `browser` string → Playwright browser type |
| `resolvePlaywrightLocator` | Map `LocatorRef` (`css` \| `xpath`) → Playwright locator |

## Breaking (EngineAdapter v2)

Custom adapters must implement `scroll` / `swipe` / `longPress` and accept `LocatorRef` (`{ strategy, value }`) instead of bare strings. Factory options are typed as `AdapterFactoryOptions`. See `@natl/core` / architecture docs; noted for the next npm publish (task 01).
