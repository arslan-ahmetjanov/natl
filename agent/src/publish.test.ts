import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  publishResult,
  resolveCommentProvider,
} from './publish.js';

describe('resolveCommentProvider', () => {
  it('respects explicit provider', () => {
    assert.equal(
      resolveCommentProvider({
        mode: 'comment',
        body: 'x',
        commentProvider: 'stdout',
        githubToken: 't',
        githubRepo: 'a/b',
        githubPrNumber: 1,
      }),
      'stdout',
    );
  });

  it('auto prefers gitlab when MR creds present', () => {
    assert.equal(
      resolveCommentProvider({
        mode: 'comment',
        body: 'x',
        commentProvider: 'auto',
        gitlabToken: 'gl',
        gitlabProjectId: '42',
        gitlabMrIid: 7,
        githubToken: 'gh',
        githubRepo: 'a/b',
        githubPrNumber: 1,
      }),
      'gitlab',
    );
  });

  it('auto falls back to github then stdout', () => {
    assert.equal(
      resolveCommentProvider({
        mode: 'comment',
        body: 'x',
        commentProvider: 'auto',
        githubToken: 'gh',
        githubRepo: 'a/b',
        githubPrNumber: 3,
      }),
      'github',
    );
    assert.equal(
      resolveCommentProvider({ mode: 'comment', body: 'x', commentProvider: 'auto' }),
      'stdout',
    );
  });
});

describe('publishResult', () => {
  it('stdout/commit return body without HTTP', async () => {
    const r = await publishResult({ mode: 'stdout', body: 'hello' });
    assert.equal(r.published, false);
    assert.equal(r.message, 'hello');
  });

  it('posts GitHub PR comment', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 201 });
    };
    const r = await publishResult({
      mode: 'comment',
      body: '## NATL',
      commentProvider: 'github',
      githubToken: 'tok',
      githubRepo: 'acme/app',
      githubPrNumber: 9,
      fetchImpl,
    });
    assert.equal(r.published, true);
    assert.match(r.message, /GitHub PR #9/);
    assert.match(calls[0]!.url, /api\.github\.com\/repos\/acme\/app\/issues\/9\/comments/);
  });

  it('posts GitLab MR note', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 201 });
    };
    const r = await publishResult({
      mode: 'comment',
      body: '## NATL',
      commentProvider: 'gitlab',
      gitlabToken: 'glpat-x',
      gitlabApiUrl: 'https://gitlab.example/api/v4',
      gitlabProjectId: 'group/proj',
      gitlabMrIid: 12,
      fetchImpl,
    });
    assert.equal(r.published, true);
    assert.match(r.message, /GitLab MR !12/);
    assert.equal(
      calls[0]!.url,
      'https://gitlab.example/api/v4/projects/group%2Fproj/merge_requests/12/notes',
    );
    const headers = calls[0]!.init?.headers as Record<string, string>;
    assert.equal(headers['PRIVATE-TOKEN'], 'glpat-x');
  });

  it('skips comment when credentials missing (auto→stdout)', async () => {
    const r = await publishResult({
      mode: 'comment',
      body: 'body-here',
      commentProvider: 'auto',
    });
    assert.equal(r.published, false);
    assert.match(r.message, /provider=stdout/);
    assert.match(r.message, /body-here/);
  });
});
