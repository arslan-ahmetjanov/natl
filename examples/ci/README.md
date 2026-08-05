# NATL Agent — CI examples (beyond GitHub Actions)

Templates for running `@natl/agent` on merge/pull requests.

| File | CI | Default mode |
|------|----|--------------|
| [gitlab-ci.yml](./gitlab-ci.yml) | GitLab CI (MR pipelines) | `stdout` dry-run |
| [Jenkinsfile](./Jenkinsfile) | Jenkins Declarative | `stdout` dry-run |
| [../.github/workflows/natl-agent.yml](../.github/workflows/natl-agent.yml) | GitHub Actions | `comment` |

## Dry-run (no tokens)

Both GitLab and Jenkins examples default to **`mode=stdout`**: the agent prints the suggested YAML + validate status to the job log. No MR/PR comment is posted.

```bash
# local equivalent
natl-agent --mode stdout --base origin/main --provider ollama
```

## GitLab MR comment

1. Copy `gitlab-ci.yml` → `.gitlab-ci.yml` (or `include:` it).
2. CI/CD variables: `LLM_API_KEY`, `GITLAB_TOKEN` (masked; `api` scope). Prefer PAT/Project Access Token over `CI_JOB_TOKEN` for notes.
3. Set `NATL_AGENT_MODE=comment` (job variable or CI variable).
4. Built-in: `CI_API_V4_URL`, `CI_PROJECT_ID`, `CI_MERGE_REQUEST_IID` → agent `comment_provider: auto|gitlab`.

## Jenkins

1. Copy `Jenkinsfile` to repo root (or Multibranch Pipeline SCM).
2. Credentials: `llm-api-key` (required for cloud LLM); optional `gitlab-token` / `github-token`.
3. Parameter `AGENT_MODE=comment` + `COMMENT_PROVIDER=auto` to post when credentials + PR/MR id are present.
4. Multibranch: `CHANGE_TARGET` / `CHANGE_ID` used for base ref; GitLab Branch Source may set `gitlabMergeRequestIid`.

**Note:** Marketplace Jenkins plugins are out of scope; comments go through the same OpenAI-compatible agent publisher (GitHub Issues API or GitLab Notes API).

## Env cheat sheet

| Variable | Purpose |
|----------|---------|
| `LLM_API_KEY` / `OPENAI_API_KEY` | Cloud LLM |
| `NATL_AGENT_MODE` | `comment` \| `stdout` \| `commit` |
| `NATL_AGENT_COMMENT_PROVIDER` | `auto` \| `github` \| `gitlab` \| `stdout` |
| `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | GitHub PR comment |
| `GITLAB_TOKEN` / `CI_JOB_TOKEN` | GitLab MR note |
| `CI_PROJECT_ID`, `CI_MERGE_REQUEST_IID`, `CI_API_V4_URL` | GitLab context (auto in GitLab CI) |
