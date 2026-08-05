import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as core from './index.js';

/** Smoke: public 1.0 surface stays importable (see docs/api-1.0.md). */
describe('public API 1.0 contract', () => {
  it('exports parse / run / config entrypoints', () => {
    assert.equal(typeof core.parseNatlFile, 'function');
    assert.equal(typeof core.parseNatlDocument, 'function');
    assert.equal(typeof core.runNatlFile, 'function');
    assert.equal(typeof core.loadMergedProjectConfig, 'function');
    assert.equal(typeof core.resolveRunSettings, 'function');
    assert.equal(typeof core.createReporters, 'function');
    assert.equal(typeof core.parseReporterName, 'function');
    assert.equal(typeof core.SecretsStore, 'function');
    assert.equal(typeof core.httpRequest, 'function');
    assert.equal(typeof core.resolveLocator, 'function');
  });

  it('exports reporter constructors and names', () => {
    assert.equal(typeof core.ConsoleReporter, 'function');
    assert.equal(typeof core.JUnitReporter, 'function');
    assert.equal(typeof core.JsonReporter, 'function');
    assert.equal(typeof core.AllureReporter, 'function');
    assert.equal(typeof core.MultiReporter, 'function');
    assert.equal(core.parseReporterName('allure'), 'allure');
  });

  it('keeps AssertError / SoftAssertError constructible', () => {
    const a = new core.AssertError('x');
    const s = new core.SoftAssertError('y', []);
    assert.ok(a instanceof Error);
    assert.ok(s instanceof Error);
  });
});
