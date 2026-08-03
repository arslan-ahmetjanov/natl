# Local HTTP stub

Minimal echo API for `http_only.yaml` / `ui_http_block.yaml` (no external httpbin).

```bash
node stubs/echo-server.mjs
# → http://127.0.0.1:8765
```

| Path | Method | Response |
|------|--------|----------|
| `/`, `/get`, `/health` | GET | `{ ok, path, method }` status 200 |
| `/post` | POST | `{ ok, json, path }` status 200 |

`PORT` env overrides the default port `8765`.
