#!/usr/bin/env node
import { runAgent } from './pipeline.js';
import { loadAgentConfig } from './config.js';
import type { AgentConfig, CommentProvider, LlmProvider } from './types.js';

function printHelp(): void {
  console.log(`natl-agent — generate NATL YAML tests from git diffs (OpenAI-compatible LLM)

Usage:
  natl-agent [options]

Options:
  --config <path>       natl-agent.yml (default: ./natl-agent.yml if present)
  --base <ref>          Diff base ref (default: origin/main)
  --head <ref>          Diff head ref (default: HEAD)
  --mode <mode>         comment | stdout | commit (default: comment)
  --comment-provider <p> auto | github | gitlab | stdout (default: auto)
  --provider <id>       openai | ollama | azure | custom
  --model <id>          Model id
  --base-url <url>      API base URL (…/v1)
  --cwd <path>          Working directory
  --test-roots <a,b>    Few-shot YAML roots (default: tests,examples)
  --cli-validate        Also spawn \`natl validate\` via npx (extra gate)
  --help                Show help

Env:
  LLM_API_KEY / OPENAI_API_KEY   cloud providers (optional for ollama)
  OPENAI_BASE_URL / NATL_AGENT_ENDPOINT
  OPENAI_MODEL / NATL_AGENT_MODEL
  NATL_AGENT_PROVIDER
  GITHUB_TOKEN, GITHUB_REPOSITORY   GitHub PR comment (mode=comment)
  GITLAB_TOKEN / CI_JOB_TOKEN       GitLab MR note (mode=comment)
  CI_PROJECT_ID, CI_MERGE_REQUEST_IID, CI_API_V4_URL

Config example: see examples/natl-agent.openai.yml
CI examples: examples/ci/gitlab-ci.yml, examples/ci/Jenkinsfile
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  cliValidate: boolean;
  configPath?: string;
  overrides: Partial<AgentConfig> & { cwd?: string };
  model?: string;
  baseUrl?: string;
  provider?: LlmProvider;
} {
  const overrides: Partial<AgentConfig> & { cwd?: string } = {};
  let help = false;
  let cliValidate = false;
  let configPath: string | undefined;
  let model: string | undefined;
  let baseUrl: string | undefined;
  let provider: LlmProvider | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i];
    switch (a) {
      case '--help':
      case '-h':
        help = true;
        break;
      case '--config':
        configPath = next();
        break;
      case '--base':
        overrides.baseRef = next();
        break;
      case '--head':
        overrides.headRef = next();
        break;
      case '--mode':
        overrides.mode = next() as AgentConfig['mode'];
        break;
      case '--comment-provider':
        overrides.commentProvider = next() as CommentProvider;
        break;
      case '--provider':
        provider = next() as LlmProvider;
        break;
      case '--model':
        model = next();
        break;
      case '--base-url':
        baseUrl = next();
        break;
      case '--cwd':
        overrides.cwd = next();
        break;
      case '--test-roots':
        overrides.testRoots = (next() ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--cli-validate':
        cliValidate = true;
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    }
  }
  return { help, cliValidate, configPath, overrides, model, baseUrl, provider };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  const config = loadAgentConfig({
    cwd: parsed.overrides.cwd,
    configPath: parsed.configPath,
    overrides: parsed.overrides,
  });

  if (parsed.provider) config.llm.provider = parsed.provider;
  if (parsed.model) config.llm.model = parsed.model;
  if (parsed.baseUrl) config.llm.endpoint = parsed.baseUrl.replace(/\/+$/, '');

  const result = await runAgent({
    config,
    useCliValidate: parsed.cliValidate,
  });
  console.log(result.message);

  const failed = result.tests.some((t) => !t.validationOk);
  if (failed) process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
