# NATL tests

YAML scenarios for **web UI + API**. Default example hits the
[docs sandbox](https://arslan-ahmetjanov.github.io/natl/sandbox.html)
(`natl init` sets `base_url` there).

## How to run

```bash
npm install @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl run tests/
```

Offline: clone [natl](https://github.com/arslan-ahmetjanov/natl) and set
`base_url` in `natl.config.yaml` to `examples/fixtures/sandbox.html`.

Copy `.env.example` to `.env` when a scenario needs secrets.
