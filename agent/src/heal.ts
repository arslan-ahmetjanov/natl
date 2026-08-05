import type { HealErrorKind } from './types.js';

/**
 * Classify validate-gate errors we may try to auto-repair.
 * Messages mirror `validateNatlYaml` in validate.ts.
 * - schema: AJV / JSON Schema
 * - parse: YAML syntax / root shape
 * - step: parseNatlDocument / missing steps / structure
 * - other: everything else (not retried)
 */
export function classifyValidationError(error: string): HealErrorKind {
  const e = error.trim();
  if (/^JSON Schema:/i.test(e) || /Schema load error/i.test(e)) {
    return 'schema';
  }
  if (
    /^YAML parse error:/i.test(e) ||
    /YAML root must be a mapping/i.test(e) ||
    /^Invalid YAML/i.test(e)
  ) {
    return 'parse';
  }
  if (
    /^NATL parse error:/i.test(e) ||
    /Unknown step|Invalid step|Invalid .+ step/i.test(e) ||
    /Missing (or empty )?required field/i.test(e) ||
    /locator|selector|testid|xpath/i.test(e)
  ) {
    return 'step';
  }
  return 'other';
}

/** Errors we attempt to heal (schema / step / parse). `other` is not retried. */
export function isHealableValidationError(error: string): boolean {
  const kind = classifyValidationError(error);
  return kind === 'schema' || kind === 'step' || kind === 'parse';
}
