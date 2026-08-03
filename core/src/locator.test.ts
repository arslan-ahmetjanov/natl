import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLocatorRef,
  normalizeElementDef,
  normalizeElementsMap,
  resolveLocator,
} from './locator.js';

describe('normalizeElementDef', () => {
  it('wraps strings with default strategy', () => {
    assert.deepEqual(normalizeElementDef('email', '#email', 'css'), {
      strategy: 'css',
      value: '#email',
    });
  });

  it('keeps object strategy / falls back for value-only', () => {
    assert.deepEqual(
      normalizeElementDef('title', { strategy: 'xpath', value: '//h1' }, 'css'),
      { strategy: 'xpath', value: '//h1' },
    );
    assert.deepEqual(normalizeElementDef('btn', { value: '#ok' }, 'css'), {
      strategy: 'css',
      value: '#ok',
    });
  });
});

describe('resolveLocator', () => {
  const scope: Record<string, unknown> = {
    email: { strategy: 'css', value: '#email' },
    title: { strategy: 'xpath', value: '//h1' },
    plain: '.plain',
  };

  const opts = {
    get: (path: string) => scope[path],
    interpolate: (s: string) => s.replace(/\$plain/, '.plain'),
    defaultStrategy: 'css',
  };

  it('resolves $element LocatorRef without losing strategy', () => {
    assert.deepEqual(resolveLocator('$title', opts), {
      strategy: 'xpath',
      value: '//h1',
    });
    assert.deepEqual(resolveLocator('$email', opts), {
      strategy: 'css',
      value: '#email',
    });
  });

  it('wraps string elements and inline selectors', () => {
    assert.deepEqual(resolveLocator('$plain', opts), {
      strategy: 'css',
      value: '.plain',
    });
    assert.deepEqual(resolveLocator('#login-btn', opts), {
      strategy: 'css',
      value: '#login-btn',
    });
  });
});

describe('normalizeElementsMap / formatLocatorRef', () => {
  it('normalizes a mixed map', () => {
    const map = normalizeElementsMap(
      {
        email: '#email',
        heading: { strategy: 'xpath', value: '//h1' },
      },
      'css',
    );
    assert.equal(map.email?.strategy, 'css');
    assert.equal(map.heading?.strategy, 'xpath');
    assert.equal(formatLocatorRef(map.heading!), 'xpath://h1');
    assert.equal(formatLocatorRef(map.email!), '#email');
  });
});
