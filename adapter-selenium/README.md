<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/adapter-selenium/brand/natl-lockup.png" alt="NATL — Not Another Testing Language" width="360" />
</p>

# @natl/adapter-selenium

Official **Selenium WebDriver** UI adapter for NATL.

Same compact YAML scenarios as Playwright; set `engine: selenium` (or `--engine selenium`). Browser choice is a capability of this adapter (`chrome` / `firefox` / `edge`). Not the default engine.

Logo assets: [`brand/`](./brand/).

## Install

```bash
npm install @natl/core @natl/adapter-selenium
# Selenium Manager downloads matching drivers automatically when a browser is installed
```

Use with the CLI:

```bash
npm install -g @natl/cli @natl/adapter-selenium
natl run tests/ --engine selenium
```

## Config (factory opts)

```yaml
# natl.config.yaml
engine: selenium
browser: chrome          # chrome | chromium | firefox | edge
headless: true
viewport:                # optional window size hint
  width: 1280
  height: 720
timeout: 15000
```

Remote Grid / corporate WebDriver hub (optional):

```bash
set SELENIUM_REMOTE_URL=http://localhost:4444/wd/hub
natl run suite.yaml --engine selenium
```

(`SELENIUM_GRID_URL` is accepted as an alias.)

Unknown `browser` values throw a clear error. If the driver/browser cannot start, the error mentions Selenium Manager and `SELENIUM_REMOTE_URL`.

## Develop

```bash
pnpm install
pnpm build
pnpm test
```

`@natl/core` is a peer dependency (`^0.1.0`). For local work against a sibling checkout use `pnpm link` or overrides (`link:../core`).

## Exports

| Export | Purpose |
|--------|---------|
| `engine` | `"selenium"` |
| `createAdapter` | `AdapterFactory` |
| `SeleniumAdapter` | Class |
| `resolveSeleniumBrowser` | Map `browser` string → chrome/firefox/edge |
| `resolveSeleniumBy` | Map `LocatorRef` (`css` \| `xpath`) → Selenium `By` |

## Notes

- Trace/video (`finalizeArtifacts`) are not implemented (Playwright-only in practice); omit or leave `trace`/`video` off.
- Gestures (`scroll` / `swipe` / `longPress`) are best-effort via WebDriver Actions / script.
- `screenshot` fullPage is viewport capture in MVP.
