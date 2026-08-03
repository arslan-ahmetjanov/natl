# NATL tests

Short YAML scenarios for **web UI + API**. Same steps across stands (`natl.config` / `--env`); UI engine defaults to Playwright.

## How to run

```bash
npm install @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl run tests/
```

Copy `.env.example` to `.env` and fill in credentials when a scenario needs them.
