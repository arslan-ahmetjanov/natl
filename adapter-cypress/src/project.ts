import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

/** Write a throwaway Cypress project that polls the NATL command bridge. */
export function writeCypressProject(bridgeUrl: string, defaultTimeout: number): string {
  const root = join(tmpdir(), `natl-cypress-${randomUUID()}`);
  mkdirSync(join(root, 'cypress', 'e2e'), { recursive: true });

  writeFileSync(
    join(root, 'cypress.config.cjs'),
    `// No require('cypress') — temp project has no node_modules.
const BRIDGE = ${JSON.stringify(bridgeUrl)};

async function poll() {
  const http = require('http');
  const url = new URL(BRIDGE + '/poll?wait=120000');
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, timeout: 125000 },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function postResult(payload) {
  const http = require('http');
  const url = new URL(BRIDGE + '/result');
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(null));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  video: false,
  screenshotOnRunFailure: false,
  fileServerFolder: '.',
  e2e: {
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
    defaultCommandTimeout: ${defaultTimeout},
    setupNodeEvents(on) {
      on('task', {
        natlPoll() {
          return poll();
        },
        natlResult(payload) {
          return postResult(payload).then(() => null);
        },
      });
    },
  },
};
`,
  );

  writeFileSync(
    join(root, 'cypress', 'e2e', 'natl-session.cy.js'),
    `/// <reference types="cypress" />

function selectTarget(cmd) {
  const timeout = cmd.timeout || ${defaultTimeout};
  if (cmd.strategy === 'xpath') {
    return cy.document({ log: false }).then((doc) => {
      const node = doc.evaluate(
        cmd.value,
        doc,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue;
      if (!node) {
        throw new Error('xpath not found: ' + cmd.value);
      }
      return cy.wrap(node, { log: false });
    });
  }
  return cy.get(cmd.value, { timeout, log: false });
}

function finish(cmd, ok, value, error) {
  return cy.task('natlResult', {
    id: cmd.id,
    ok: !!ok,
    value,
    error: error != null ? String(error) : undefined,
  });
}

function runLoop() {
  cy.task('natlPoll', null, { timeout: 130000 }).then((cmd) => {
    if (!cmd || cmd.op === 'end') {
      if (cmd && cmd.id) {
        finish(cmd, true).then(() => undefined);
      }
      return;
    }

    const next = () => runLoop();

    if (cmd.op === 'goto') {
      cy.visit(cmd.url, { failOnStatusCode: false })
        .then(() => finish(cmd, true))
        .then(next);
      return;
    }
    if (cmd.op === 'click') {
      selectTarget(cmd).click().then(() => finish(cmd, true)).then(next);
      return;
    }
    if (cmd.op === 'fill') {
      selectTarget(cmd)
        .clear()
        .type(String(cmd.value ?? ''), { delay: 0 })
        .then(() => finish(cmd, true))
        .then(next);
      return;
    }
    if (cmd.op === 'select') {
      selectTarget(cmd)
        .select(String(cmd.value ?? ''))
        .then(() => finish(cmd, true))
        .then(next);
      return;
    }
    if (cmd.op === 'check') {
      selectTarget(cmd).check({ force: true }).then(() => finish(cmd, true)).then(next);
      return;
    }
    if (cmd.op === 'uncheck') {
      selectTarget(cmd).uncheck({ force: true }).then(() => finish(cmd, true)).then(next);
      return;
    }
    if (cmd.op === 'wait') {
      const state = cmd.state || 'visible';
      if (state === 'hidden' || state === 'detached') {
        if (cmd.strategy === 'css') {
          cy.get(cmd.value, { timeout: cmd.timeout || ${defaultTimeout} })
            .should('not.exist')
            .then(() => finish(cmd, true))
            .then(next);
        } else {
          finish(cmd, false, undefined, 'xpath wait hidden/detached not supported in MVP').then(next);
        }
      } else {
        selectTarget(cmd)
          .should('be.visible')
          .then(() => finish(cmd, true))
          .then(next);
      }
      return;
    }
    if (cmd.op === 'waitMs') {
      cy.wait(Number(cmd.ms) || 0).then(() => finish(cmd, true)).then(next);
      return;
    }
    if (cmd.op === 'screenshot') {
      cy.screenshot('natl-shot', {
        capture: cmd.fullPage ? 'fullPage' : 'viewport',
      })
        .then(() => finish(cmd, true))
        .then(next);
      return;
    }
    if (cmd.op === 'getText') {
      selectTarget(cmd)
        .filter(':visible')
        .first()
        .invoke('text')
        .then((text) => finish(cmd, true, String(text).trim()))
        .then(next);
      return;
    }
    if (cmd.op === 'getAttr') {
      selectTarget(cmd)
        .invoke('attr', cmd.attr)
        .then((v) => finish(cmd, true, v == null ? null : String(v)))
        .then(next);
      return;
    }
    if (cmd.op === 'isVisible') {
      const t = cmd.timeout || ${defaultTimeout};
      if (cmd.strategy !== 'css') {
        selectTarget(cmd)
          .should('be.visible')
          .then(() => finish(cmd, true, true), () => finish(cmd, true, false))
          .then(next);
        return;
      }
      cy.get(cmd.value, { timeout: t, log: false })
        .should('be.visible')
        .then(
          () => finish(cmd, true, true),
          () => finish(cmd, true, false),
        )
        .then(next);
      return;
    }
    if (cmd.op === 'getCurrentUrl') {
      cy.url().then((u) => finish(cmd, true, u)).then(next);
      return;
    }
    if (cmd.op === 'scroll') {
      selectTarget(cmd).scrollIntoView().then(() => finish(cmd, true)).then(next);
      return;
    }
    finish(cmd, false, undefined, 'unsupported or unknown op: ' + cmd.op).then(next);
  });
}

describe('natl-cypress-bridge', () => {
  it('session', { defaultCommandTimeout: ${defaultTimeout} }, () => {
    runLoop();
  });
});
`,
  );

  return root;
}

export function removeCypressProject(root: string): void {
  rmSync(root, { recursive: true, force: true });
}
