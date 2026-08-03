import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { By } from 'selenium-webdriver';
import { resolveSeleniumBrowser, resolveSeleniumBy } from './index.js';

describe('resolveSeleniumBrowser', () => {
  it('defaults to chrome', () => {
    assert.equal(resolveSeleniumBrowser(), 'chrome');
    assert.equal(resolveSeleniumBrowser(undefined), 'chrome');
  });

  it('maps chromium → chrome and accepts firefox/edge', () => {
    assert.equal(resolveSeleniumBrowser('chromium'), 'chrome');
    assert.equal(resolveSeleniumBrowser(' Firefox '), 'firefox');
    assert.equal(resolveSeleniumBrowser('EDGE'), 'edge');
  });

  it('throws a clear error for unsupported browser ids', () => {
    assert.throws(
      () => resolveSeleniumBrowser('webkit'),
      /does not support browser "webkit"/,
    );
    assert.throws(() => resolveSeleniumBrowser('safari'), /chrome.*firefox.*edge/);
  });
});

describe('resolveSeleniumBy', () => {
  it('maps css and xpath', () => {
    const css = resolveSeleniumBy({ strategy: 'css', value: '#x' });
    assert.equal(css.using, By.css('#x').using);
    assert.equal(css.value, '#x');

    const xp = resolveSeleniumBy({ strategy: 'xpath', value: '//h1' });
    assert.equal(xp.using, 'xpath');
    assert.equal(xp.value, '//h1');

    const xpPrefixed = resolveSeleniumBy({ strategy: 'xpath', value: 'xpath=//h1' });
    assert.equal(xpPrefixed.value, '//h1');
  });

  it('throws for unsupported strategy', () => {
    assert.throws(
      () => resolveSeleniumBy({ strategy: 'role', value: 'button' }),
      /does not support locator strategy "role"/,
    );
  });
});
