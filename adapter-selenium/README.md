<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@natl/adapter-selenium/brand/natl-lockup.png" alt="NATL — YAML test runner" width="360" />
</p>

# @natl/adapter-selenium

Official **Selenium WebDriver** UI adapter for NATL.

**Status: supported with limits** — fine for Grid / classic WebDriver pilots; prefer Playwright when you need Trace Viewer or video. Same compact YAML; set `engine: selenium` (or `--engine selenium`).

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

## Artifact parity (vs Playwright)

| Capability | Selenium | Notes |
|------------|----------|--------|
| Fail / step `screenshot` | Yes | Written under `artifacts_dir` like Playwright |
| `fullPage` screenshot | Best-effort | Chrome/Edge via CDP `captureBeyondViewport`; Firefox → viewport |
| Trace (`.zip` / Trace Viewer) | No | Explicit no-op; warns when `trace` is `on` / `on-fail` and a keep would apply |
| Video (`.webm`) | No | Explicit no-op; warns when `video` is `on` / `on-fail` and a keep would apply |

Set `trace: off` and `video: off` in config (or CLI) to silence those warnings. Use `@natl/adapter-playwright` when you need Trace Viewer or video.

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
| `describeUnsupportedSeleniumArtifacts` | Warn text when trace/video cannot be saved |

## Notes

- Gestures (`scroll` / `swipe` / `longPress`) are best-effort via WebDriver Actions / script.
- See **Artifact parity** above for screenshot / trace / video.
