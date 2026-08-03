import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePlaywrightBrowser, resolvePlaywrightLocator } from './index.js';

describe('resolvePlaywrightBrowser', () => {
  it('defaults to chromium', () => {
    assert.equal(resolvePlaywrightBrowser(), resolvePlaywrightBrowser('chromium'));
    assert.equal(resolvePlaywrightBrowser(undefined), resolvePlaywrightBrowser('chromium'));
  });

  it('accepts chromium, firefox, webkit (case-insensitive)', () => {
    assert.ok(resolvePlaywrightBrowser('Firefox'));
    assert.ok(resolvePlaywrightBrowser('WEBKIT'));
    assert.ok(resolvePlaywrightBrowser(' chromium '));
  });

  it('throws a clear error for unsupported browser ids', () => {
    assert.throws(
      () => resolvePlaywrightBrowser('safari'),
      /does not support browser "safari"/,
    );
    assert.throws(() => resolvePlaywrightBrowser('safari'), /chromium, firefox, webkit/);
  });
});

describe('resolvePlaywrightLocator', () => {
  const fakePage = {
    locator: (sel: string) => sel,
  };

  it('maps css and xpath', () => {
    assert.equal(
      resolvePlaywrightLocator(fakePage as never, { strategy: 'css', value: '#x' }),
      '#x',
    );
    assert.equal(
      resolvePlaywrightLocator(fakePage as never, { strategy: 'xpath', value: '//h1' }),
      'xpath=//h1',
    );
  });

  it('throws for unsupported strategy', () => {
    assert.throws(
      () => resolvePlaywrightLocator(fakePage as never, { strategy: 'role', value: 'button' }),
      /does not support locator strategy "role"/,
    );
  });
});
