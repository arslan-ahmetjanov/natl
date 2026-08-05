import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  parseUnifiedDiff,
  detectLanguage,
  analyzeSemanticDiff,
  analyzeSemanticDiffAsync,
  extractEntitiesTreeSitter,
  extractImportHints,
  buildContext,
  buildUserPrompt,
  extractYamlFromResponse,
  extractNatlYamlFromResponse,
  suggestFileName,
  buildLlmConfig,
  loadAgentConfig,
  createLlmClient,
  normalizeNatlYaml,
  validateNatlYaml,
  runAgent,
  SYSTEM_PROMPT,
} from '@natl/agent';
import type { DiffFile, UirChange } from '@natl/agent';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

describe('release: diff + languages', () => {
  it('parses unified diff fixture', () => {
    const text = readFileSync(join(fixtures, 'sample.diff'), 'utf8');
    const files = parseUnifiedDiff(text);
    assert.equal(files.length, 1);
    assert.equal(files[0]!.path, 'src/api/user.py');
    assert.equal(detectLanguage(files[0]!.path), 'python');
  });

  it('maps extensions for DoD languages', () => {
    assert.equal(detectLanguage('a.py'), 'python');
    assert.equal(detectLanguage('a.ts'), 'typescript');
    assert.equal(detectLanguage('a.js'), 'javascript');
    assert.equal(detectLanguage('a.java'), 'java');
    assert.equal(detectLanguage('a.go'), 'go');
    assert.equal(detectLanguage('a.cs'), 'csharp');
  });
});

describe('release: semantic UIR', () => {
  it('heuristic finds added python function from fixture', () => {
    const text = readFileSync(join(fixtures, 'sample.diff'), 'utf8');
    const files = parseUnifiedDiff(text);
    const uir = analyzeSemanticDiff(files);
    const hit = uir.find((c) => c.entity === 'get_user');
    assert.ok(hit);
    assert.equal(hit!.changeType, 'FUNCTION_ADDED');
  });

  it('tree-sitter extracts entities for 5 languages', async () => {
    const samples: Array<{ lang: Parameters<typeof extractEntitiesTreeSitter>[1]; src: string; name: string }> = [
      { lang: 'python', src: 'async def get_user(timeout=None):\n  return {}\n', name: 'get_user' },
      { lang: 'typescript', src: 'export async function login(u: string) { return true }\n', name: 'login' },
      { lang: 'javascript', src: 'function ping() { return 1 }\n', name: 'ping' },
      { lang: 'go', src: 'package main\nfunc GetUser() error { return nil }\n', name: 'GetUser' },
      { lang: 'java', src: 'public class Api {\n  public User getUser(int t) { return null; }\n}\n', name: 'getUser' },
      { lang: 'csharp', src: 'public class Api {\n  public User GetUser(int t) { return null; }\n}\n', name: 'GetUser' },
    ];
    for (const s of samples) {
      const ents = await extractEntitiesTreeSitter(s.src, s.lang);
      assert.ok(ents, `tree-sitter null for ${s.lang}`);
      assert.ok(
        ents!.some((e) => e.name === s.name),
        `missing ${s.name} in ${s.lang}: ${JSON.stringify(ents)}`,
      );
    }
  });

  it('async analyzer detects FUNCTION_CHANGED', async () => {
    const files: DiffFile[] = [
      {
        path: 'src/login.ts',
        status: 'modified',
        patch: [
          'diff --git a/src/login.ts b/src/login.ts',
          '--- a/src/login.ts',
          '+++ b/src/login.ts',
          '@@ -1,3 +1,3 @@',
          '-export function login(user: string) {',
          '+export async function login(user: string, timeout: number) {',
          '   return true',
          ' }',
        ].join('\n'),
      },
    ];
    const uir = await analyzeSemanticDiffAsync(files);
    const hit = uir.find((c) => c.entity === 'login');
    assert.ok(hit);
    assert.equal(hit!.changeType, 'FUNCTION_CHANGED');
  });
});

describe('release: context + prompt', () => {
  it('scores YAML mentioning entity', () => {
    const changes: UirChange[] = [
      {
        file: 'a.py',
        language: 'python',
        changeType: 'FUNCTION_ADDED',
        entity: 'get_user',
        description: 'x',
        risk: 'MEDIUM',
      },
    ];
    const ctx = buildContext({
      cwd: join(here, '..'),
      roots: ['fixtures'],
      changes,
      maxExamples: 2,
      importHints: ['./api/user'],
    });
    assert.ok(ctx.length >= 1);
    assert.match(ctx[0]!.path, /login\.yaml/);
  });

  it('builds prompt with UIR and JSON→YAML extract', () => {
    assert.match(SYSTEM_PROMPT, /NATL/);
    assert.match(SYSTEM_PROMPT, /JSON object/);
    const prompt = buildUserPrompt({
      changes: [
        {
          file: 'a.py',
          language: 'python',
          changeType: 'FUNCTION_ADDED',
          entity: 'get_user',
          description: 'added',
          risk: 'MEDIUM',
        },
      ],
      examples: [],
    });
    assert.match(prompt, /get_user/);
    assert.equal(
      extractYamlFromResponse('```yaml\nname: X\nsteps:\n  - log: ok\n```'),
      'name: X\nsteps:\n  - log: ok',
    );
    const fromJson = extractNatlYamlFromResponse(
      '{"name":"Agent get_user","engine":"http","steps":[{"get":"https://example.com/user","save":"u"},{"assert":"$u.status == 200"}]}',
    );
    assert.match(fromJson, /name: Agent get_user/);
    assert.equal(validateNatlYaml(fromJson).ok, true, validateNatlYaml(fromJson).error);
    assert.equal(
      suggestFileName([
        {
          file: 'a.py',
          language: 'python',
          changeType: 'FUNCTION_ADDED',
          entity: 'get_user',
          description: 'x',
          risk: 'HIGH',
        },
      ]),
      'agent_get_user.yaml',
    );
  });

  it('extracts import hints', () => {
    const hints = extractImportHints(`import { x } from './util'\n`);
    assert.ok(hints.includes('./util'));
  });
});

describe('release: LLM gateway + config', () => {
  it('forces temperature 0 and defaults ollama endpoint', () => {
    const saved = {
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      NATL_AGENT_ENDPOINT: process.env.NATL_AGENT_ENDPOINT,
    };
    delete process.env.OPENAI_BASE_URL;
    delete process.env.NATL_AGENT_ENDPOINT;
    try {
      const llm = buildLlmConfig({
        provider: 'openai',
        parameters: { temperature: 0.9, max_tokens: 128 },
      });
      assert.equal(llm.parameters.temperature, 0);
      assert.equal(
        buildLlmConfig({ provider: 'ollama' }).endpoint,
        'http://localhost:11434/v1',
      );
    } finally {
      if (saved.OPENAI_BASE_URL !== undefined) {
        process.env.OPENAI_BASE_URL = saved.OPENAI_BASE_URL;
      }
      if (saved.NATL_AGENT_ENDPOINT !== undefined) {
        process.env.NATL_AGENT_ENDPOINT = saved.NATL_AGENT_ENDPOINT;
      }
    }
  });

  it('loads natl-agent.local.yml', () => {
    const cfg = loadAgentConfig({
      cwd: join(here, '..'),
      configPath: join(here, '..', 'natl-agent.local.yml'),
    });
    assert.equal(cfg.llm.provider, 'custom');
    assert.match(cfg.llm.endpoint, /8787/);
    assert.equal(cfg.mode, 'stdout');
  });

  it('createLlmClient posts OpenAI-compatible body', async () => {
    let url = '';
    let body: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'name: T\nsteps:\n  - log: ok\n' } }],
        }),
        { status: 200 },
      );
    };
    const client = createLlmClient(
      {
        provider: 'custom',
        endpoint: 'http://127.0.0.1:8787/v1',
        apiKey: '',
        model: 'tiny',
        parameters: { temperature: 0, maxTokens: 64, topP: 0.9, seed: 1 },
      },
      fetchImpl,
    );
    const r = await client.complete([{ role: 'user', content: 'hi' }]);
    assert.equal(url, 'http://127.0.0.1:8787/v1/chat/completions');
    assert.equal(body.temperature, 0);
    assert.match(r.content, /name:/);
  });
});

describe('release: validate gate', () => {
  it('accepts compact NATL and rejects broken', () => {
    assert.equal(
      validateNatlYaml(`name: OK
engine: http
steps:
  - get: https://example.com
    save: r
  - assert: $r.status == 200
`).ok,
      true,
    );
    assert.equal(validateNatlYaml('name: No steps\n').ok, false);
    assert.equal(
      validateNatlYaml(`name: Bad
steps:
  - not_a_real_step: true
`).ok,
      false,
    );
  });

  it('deterministic normalize fixes mega-step oneOf failure', () => {
    const broken = `name: Get user
steps:
  - goto: https://example.com/user
    fill: "[data-testid=email]"
    with: user@example.com
    click: button[type=submit]
    get: https://api.example.com/x
    save: r
    assert: $r.status == 200
`;
    assert.equal(validateNatlYaml(broken).ok, false);
    const { yaml, changed } = normalizeNatlYaml(broken);
    assert.equal(changed, true);
    assert.equal(validateNatlYaml(yaml).ok, true, validateNatlYaml(yaml).error);
  });
});

describe('release: pipeline e2e (stub LLM)', () => {
  it('runs pipeline with llmOverride and validates YAML', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'natl-agent-rel-'));
    mkdirSync(join(repo, '.git'));
    // Minimal git repo so fetchDiff may fail — we inject via override by testing validate path:
    // Prefer testing runAgent pieces: use llmOverride + mock empty diff by stubbing would need git.
    // Instead: call validate + prompt path already covered; here simulate GeneratedTest path via runAgent
    // only if git works. Fallback: construct config and ensure createLlmClient path works.

    writeFileSync(
      join(repo, 'natl-agent.yml'),
      [
        'llm:',
        '  provider: custom',
        '  endpoint: http://127.0.0.1:9/v1',
        '  model: stub',
        'mode: stdout',
        'test_roots: [fixtures]',
      ].join('\n'),
      'utf8',
    );
    mkdirSync(join(repo, 'fixtures'));
    writeFileSync(
      join(repo, 'fixtures', 'demo.yaml'),
      'name: Demo get_user\nsteps:\n  - log: x\n',
      'utf8',
    );

    // Init real git so fetchDiff works
    const { spawnSync } = await import('node:child_process');
    const git = (args: string[]) =>
      spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    git(['init']);
    git(['config', 'user.email', 'test@natl.dev']);
    git(['config', 'user.name', 'NATL Test']);
    writeFileSync(join(repo, 'src_user.py'), 'def existing():\n    pass\n', 'utf8');
    git(['add', '-A']);
    git(['commit', '-m', 'base']);
    writeFileSync(
      join(repo, 'src_user.py'),
      'def existing():\n    pass\n\nasync def get_user(timeout=None):\n    return {}\n',
      'utf8',
    );
    git(['add', '-A']);
    git(['commit', '-m', 'change']);

    const config = loadAgentConfig({
      cwd: repo,
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'stdout',
        testRoots: ['fixtures'],
      },
    });

    const stubYaml = `name: Agent get_user
engine: http
steps:
  - get: https://example.com/user
    save: u
  - assert: $u.status == 200
`;

    const result = await runAgent({
      config,
      llmOverride: async () => stubYaml,
    });

    assert.ok(result.tests.length >= 1, result.message);
    assert.equal(result.tests[0]!.validationOk, true, result.tests[0]!.validationError);
    assert.match(result.tests[0]!.yaml, /get_user|example\.com/);
  });

  it('self-heals invalid YAML when enabled (stub LLM)', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'natl-agent-heal-rel-'));
    writeFileSync(
      join(repo, 'natl-agent.yml'),
      [
        'llm:',
        '  provider: custom',
        '  endpoint: http://127.0.0.1:9/v1',
        '  model: stub',
        'mode: stdout',
        'test_roots: [fixtures]',
        'self_healing:',
        '  enabled: true',
        '  max_retries: 2',
      ].join('\n'),
      'utf8',
    );
    mkdirSync(join(repo, 'fixtures'));
    writeFileSync(
      join(repo, 'fixtures', 'demo.yaml'),
      'name: Demo get_user\nsteps:\n  - log: x\n',
      'utf8',
    );

    const { spawnSync } = await import('node:child_process');
    const git = (args: string[]) =>
      spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    git(['init']);
    git(['config', 'user.email', 'test@natl.dev']);
    git(['config', 'user.name', 'NATL Test']);
    writeFileSync(join(repo, 'src_user.py'), 'def existing():\n    pass\n', 'utf8');
    git(['add', '-A']);
    git(['commit', '-m', 'base']);
    writeFileSync(
      join(repo, 'src_user.py'),
      'def existing():\n    pass\n\nasync def get_user(timeout=None):\n    return {}\n',
      'utf8',
    );
    git(['add', '-A']);
    git(['commit', '-m', 'change']);

    const config = loadAgentConfig({
      cwd: repo,
      overrides: {
        baseRef: 'HEAD~1',
        headRef: 'HEAD',
        mode: 'stdout',
        testRoots: ['fixtures'],
        selfHealing: { enabled: true, maxRetries: 2 },
      },
    });

    const bad = `name: Bad
steps:
  - not_a_real_step: true
`;
    const good = `name: Agent get_user
engine: http
steps:
  - get: https://example.com/user
    save: u
  - assert: $u.status == 200
`;

    const result = await runAgent({
      config,
      llmOverride: async (_p, meta) => {
        if (!meta || meta.attempt === 0) return bad;
        return good;
      },
    });

    assert.equal(result.tests[0]!.validationOk, true, result.tests[0]!.validationError);
    assert.equal(result.tests[0]!.healed, true);
    assert.match(result.message, /Self-healing history/);
  });
});

describe('release: comment publisher', () => {
  it('resolves gitlab and posts MR note via mock fetch', async () => {
    const { resolveCommentProvider, publishResult } = await import('@natl/agent');
    assert.equal(
      resolveCommentProvider({
        mode: 'comment',
        body: 'x',
        commentProvider: 'auto',
        gitlabToken: 't',
        gitlabProjectId: '1',
        gitlabMrIid: 2,
      }),
      'gitlab',
    );

    let posted = '';
    const r = await publishResult({
      mode: 'comment',
      body: '## from release suite',
      commentProvider: 'gitlab',
      gitlabToken: 't',
      gitlabApiUrl: 'https://gitlab.example/api/v4',
      gitlabProjectId: '9',
      gitlabMrIid: 3,
      fetchImpl: async (url, init) => {
        posted = String(url);
        assert.match(String(init?.body ?? ''), /from release suite/);
        return new Response('{}', { status: 201 });
      },
    });
    assert.equal(r.published, true);
    assert.match(posted, /merge_requests\/3\/notes/);
  });
});
