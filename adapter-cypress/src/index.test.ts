import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCypressBrowser, resolveCypressLocator } from './index.js';

describe('resolveCypressBrowser', () => {
  it('defaults to chrome', () => {
    assert.equal(resolveCypressBrowser(), 'chrome');
  });

  it('maps chromium → chrome', () => {
    assert.equal(resolveCypressBrowser('chromium'), 'chrome');
    assert.equal(resolveCypressBrowser(' electron '), 'electron');
  });

  it('throws for unsupported ids', () => {
    assert.throws(() => resolveCypressBrowser('webkit'), /does not support browser "webkit"/);
  });
});

describe('resolveCypressLocator', () => {
  it('accepts css and xpath', () => {
    assert.deepEqual(resolveCypressLocator({ strategy: 'CSS', value: '#a' }), {
      strategy: 'css',
      value: '#a',
    });
    assert.deepEqual(resolveCypressLocator({ strategy: 'xpath', value: '//h1' }), {
      strategy: 'xpath',
      value: '//h1',
    });
  });

  it('throws for unsupported strategy', () => {
    assert.throws(
      () => resolveCypressLocator({ strategy: 'role', value: 'button' }),
      /does not support locator strategy "role"/,
    );
  });
});
