import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import Ajv from 'ajv';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '../schemas/natl.test.schema.json');
const examplesDir = join(here, '../../examples');

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function collectYamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === '.github' || name.name === 'fixtures' || name.name === 'config') continue;
      out.push(...collectYamlFiles(p));
    } else if (name.name.endsWith('.yaml') || name.name.endsWith('.yml')) {
      if (name.name.startsWith('natl.config')) continue;
      out.push(p);
    }
  }
  return out;
}

describe('natl.test.schema.json', () => {
  it('accepts IDE-valid compact examples', () => {
    const files = collectYamlFiles(examplesDir);
    assert.ok(files.length >= 5, `expected example scenarios, got ${files.length}`);

    const failures: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      let doc: unknown;
      try {
        doc = parse(raw);
      } catch (e) {
        failures.push(`${file}: YAML parse error: ${(e as Error).message.split('\n')[0]}`);
        continue;
      }
      if (!validate(doc)) {
        failures.push(
          `${file}: schema\n${JSON.stringify(validate.errors, null, 2)}`,
        );
      }
    }
    assert.equal(failures.length, 0, failures.join('\n\n'));
  });

  it('accepts compact fill + assert sibling forms', () => {
    const doc = {
      name: 'schema sample',
      engine: 'playwright',
      steps: [
        { fill: '#email', with: '$user' },
        { wait: '.dashboard visible' },
        { assert: '.welcome', text: 'Hello' },
        { assert: '.x', visible: true },
        { soft_assert: '.y', visible: true },
        { get_text: '.z', save: 'z' },
        { scroll: '#footer', into_view: true },
        { swipe: '#carousel', direction: 'left' },
        { long_press: '#card', duration_ms: 700 },
      ],
    };
    assert.equal(validate(doc), true, JSON.stringify(validate.errors, null, 2));
  });
});
