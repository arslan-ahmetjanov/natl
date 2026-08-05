import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { parseNatlDocument } from '@natl/core';

export interface ValidateResult {
  ok: boolean;
  error?: string;
}

const require = createRequire(import.meta.url);
const AjvCtor = require('ajv') as new (opts?: object) => {
  compile(schema: object): ValidateFunction;
};

let cachedValidate: ValidateFunction | undefined;

function loadSchemaValidator(): ValidateFunction {
  if (cachedValidate) return cachedValidate;
  const schemaPath = require.resolve('@natl/core/schemas/natl.test.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  cachedValidate = ajv.compile(schema);
  return cachedValidate;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'JSON Schema validation failed';
  return errors
    .slice(0, 8)
    .map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim())
    .join('; ');
}

/**
 * Quality gates: YAML parse → AJV (natl.test.schema.json) → parseNatlDocument.
 * Equivalent in-process gate to `natl validate` for generated scenarios.
 */
export function validateNatlYaml(
  source: string,
  fileName = 'generated.yaml',
): ValidateResult {
  let doc: unknown;
  try {
    doc = parseYaml(source);
  } catch (err) {
    return {
      ok: false,
      error: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: 'YAML root must be a mapping object' };
  }
  const obj = doc as Record<string, unknown>;
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    return { ok: false, error: 'Missing required field: name' };
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { ok: false, error: 'Missing or empty required field: steps' };
  }

  try {
    const validate = loadSchemaValidator();
    if (!validate(obj)) {
      return { ok: false, error: `JSON Schema: ${formatAjvErrors(validate.errors)}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Schema load error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    parseNatlDocument(obj, fileName);
  } catch (err) {
    return {
      ok: false,
      error: `NATL parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { ok: true };
}

/**
 * Optional extra gate: spawn `natl validate` (requires @natl/cli).
 * In-process `validateNatlYaml` is the default gate.
 */
export function runNatlValidateCli(
  source: string,
  opts?: { cwd?: string; natlBin?: string },
): ValidateResult {
  const dir = mkdtempSync(join(tmpdir(), 'natl-agent-'));
  const file = join(dir, 'candidate.yaml');
  try {
    writeFileSync(file, source, 'utf8');
    const bin = opts?.natlBin ?? 'npx';
    const args =
      bin === 'npx'
        ? ['--yes', '@natl/cli', 'validate', file]
        : ['validate', file];
    const r = spawnSync(bin, args, {
      cwd: opts?.cwd,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (r.status === 0) return { ok: true };
    const err = (r.stderr || r.stdout || `exit ${r.status}`).trim();
    return { ok: false, error: err.slice(0, 1000) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
