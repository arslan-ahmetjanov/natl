# Adapters

NATL scenarios stay in YAML. **UI engines** plug in via `EngineAdapter`. Pick an engine with `engine:` in the scenario / `natl.config.yaml`, or `--engine` on the CLI.

| `engine:` | Package | Notes |
|-----------|---------|--------|
| `playwright` | [`@natl/adapter-playwright`](https://www.npmjs.com/package/@natl/adapter-playwright) | **Default.** Chromium / Firefox / WebKit |
| `selenium` | [`@natl/adapter-selenium`](https://www.npmjs.com/package/@natl/adapter-selenium) | Chrome / Firefox / Edge; optional `SELENIUM_REMOTE_URL` |
| `cypress` | [`@natl/adapter-cypress`](https://www.npmjs.com/package/@natl/adapter-cypress) | MVP command-bridge; peer `cypress` |
| `http` | built into `@natl/core` | API-only; no browser |

Browsers are an **adapter capability**, not a hard-coded matrix in the language.

## Install examples

```bash
# Default path
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium

# Selenium
npm install -g @natl/cli @natl/adapter-selenium

# Cypress
npm install -g @natl/cli @natl/adapter-cypress cypress
npx cypress install
```

## Config sketch

```yaml
# natl.config.yaml
engine: playwright
browser: chromium          # opaque to core — validated by the adapter
headless: true
timeout: 15000
trace: on-fail             # Playwright
video: off
```

```bash
natl run suite.yaml --engine selenium
natl run suite.yaml --engine cypress
natl run api.yaml --engine http
```

## Mixing UI and HTTP

Keep the root UI engine and wrap API steps:

```yaml
engine: playwright
steps:
  - goto: $base_url
  - do: login.login
    user: $user
    pass: $pass
  - with: http
    steps:
      - get: $api_base/get
        save: ping
      - assert: $ping.status == 200
```

## Custom adapters

```bash
natl run suite.yaml --engine myengine --engine-package @acme/natl-adapter
```

Implement `EngineAdapter` v2 (auto-wait, `LocatorRef`, gestures). See [Architecture](architecture.md).
