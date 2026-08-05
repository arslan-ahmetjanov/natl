# Live LLM eval fixtures

Corpus is **generated at runtime** by `src/live-corpus.ts` (default N=50), not checked in as raw private PR dumps.

- No secrets, API keys, or real emails
- Languages: Python / TS / JS / Go / Java / C#
- Entities: synthetic `get_user_*`, `create_order_*`, …

```bash
pnpm eval:live:dry   # corpus + UIR smoke
pnpm eval:live       # needs LLM on OPENAI_BASE_URL (default :8787)
```

Report: `agent/eval/live-report.json` (gitignored).
