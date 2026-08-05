import { stringify as stringifyYaml } from 'yaml';
import type { ContextExample, UirChange } from './types.js';

export const SELECTOR_HINTS = `Locator preference (stable → fragile):
1. data-testid / data-test / getByTestId
2. role + accessible name (button "Submit", textbox "Email")
3. Visible text / label
4. Avoid brittle CSS chains and absolute XPath unless no alternative.`;

/** Canonical step shapes that match natl.test.schema.json (object form, not fill+with keys). */
export const JSON_STEP_HINTS = `Canonical JSON step shapes (use these keys only):
- {"goto":"https://example.com/path"}
- {"fill":"[data-testid=email]","with":"user@example.com"}
- {"click":"button[type=submit]"}
- {"get":"https://api.example.com/x","save":"r"}
- {"post":"https://api.example.com/x","body":{},"save":"r"}
- {"assert":"$r.status == 200"}
- {"assert":{"text":"Welcome","visible":true}}
- {"log":"checkpoint"}
- {"wait":"[data-testid=ready]"}
Do NOT invent keys like fill+with, submit-button, wait-for-page-to-load.`;

export const SYSTEM_PROMPT = `You are an expert QA engineer for NATL (web UI + HTTP test runner).
Generate ONE valid NATL scenario as a JSON object (not YAML).

Rules:
- Output ONLY a JSON object (no markdown fences, no commentary).
- Required fields: "name" (string), "steps" (array of step objects).
- Optional: "engine" ("playwright" | "http"), "vars", "tags".
- ${JSON_STEP_HINTS}
- Use "engine":"playwright" for UI, "engine":"http" for API-only.
- Do not invent secrets; use "$env.VAR" or placeholder vars under "vars".
- Keep the scenario short and focused on the changed entity.
- Assertions belong inside steps as "assert" (never a top-level "assertions" key).
- ${SELECTOR_HINTS}

Example:
{"name":"Get user","engine":"http","steps":[{"get":"https://example.com/user","save":"u"},{"assert":"$u.status == 200"}]}`;

export function buildUserPrompt(opts: {
  changes: UirChange[];
  examples: ContextExample[];
  patchHints?: string;
}): string {
  const uir = JSON.stringify(opts.changes, null, 2);
  const parts: string[] = [
    '## Semantic changes (UIR)',
    '```json',
    uir,
    '```',
  ];

  if (opts.examples.length) {
    parts.push('', '## Few-shot NATL examples from this repository (YAML; emit equivalent JSON)');
    for (const ex of opts.examples) {
      parts.push(`### ${ex.path}`, '```yaml', ex.content.trim(), '```');
    }
  }

  if (opts.patchHints) {
    parts.push('', '## Diff excerpt', '```', opts.patchHints.slice(0, 6000), '```');
  }

  parts.push(
    '',
    '## Locator guidance',
    SELECTOR_HINTS,
    '',
    '## Output',
    'Return a single JSON object for the highest-risk change above.',
    JSON_STEP_HINTS,
  );
  return parts.join('\n');
}

/**
 * Follow-up prompt after validate gate failure (self-healing).
 * LLM must return a fixed full JSON document only.
 */
export function buildRepairPrompt(opts: {
  previousYaml: string;
  validationError: string;
  attempt: number;
  maxRetries: number;
  kind?: string;
}): string {
  return [
    '## Self-healing repair',
    `Attempt ${opts.attempt} of ${opts.maxRetries} (temperature=0).`,
    opts.kind ? `Error class: ${opts.kind}` : '',
    '',
    'The previous NATL document failed the quality gate (`natl validate` / AJV + parseNatlDocument).',
    'Fix it and output ONLY a corrected JSON object (no markdown fences, no commentary).',
    '',
    '## Validation error',
    opts.validationError,
    '',
    '## Previous document (YAML form of last attempt)',
    '```yaml',
    opts.previousYaml.trim(),
    '```',
    '',
    '## Fix guidance',
    '- Keep name/steps; fix schema and step shapes.',
    '- Assertions belong in steps as "assert", not a top-level "assertions" key.',
    '- Prefer engine http for API-only smoke; playwright for UI.',
    '- ' + JSON_STEP_HINTS.replace(/\n/g, '\n- '),
    '- ' + SELECTOR_HINTS.replace(/\n/g, '\n- '),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Strip accidental markdown fences from YAML model output. */
export function extractYamlFromResponse(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:yaml|yml)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) return fenced[1]!.trim();
  const inner = trimmed.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/i);
  if (inner) return inner[1]!.trim();
  return trimmed;
}

/** Parse a JSON object from model output (fences, raw, or first {...} slice). */
export function extractJsonObjectFromResponse(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const fullFence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fullFence?.[1]) candidates.push(fullFence[1].trim());
  const innerFence = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
  if (innerFence?.[1]) candidates.push(innerFence[1].trim());
  candidates.push(trimmed);

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  for (const c of candidates) {
    try {
      const v = JSON.parse(c) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/** Serialize a NATL JSON document to YAML for files / PR comments. */
export function natlJsonToYaml(doc: Record<string, unknown>): string {
  return stringifyYaml(doc, { lineWidth: 100 }).trimEnd();
}

/**
 * Prefer JSON→YAML; fall back to YAML extract for stubs / older models.
 */
export function extractNatlYamlFromResponse(text: string): string {
  const json = extractJsonObjectFromResponse(text);
  if (json) return natlJsonToYaml(json);
  return extractYamlFromResponse(text);
}

export function suggestFileName(changes: UirChange[]): string {
  const primary =
    changes.find((c) => c.risk === 'HIGH') ??
    changes.find((c) => c.entity && !c.entity.includes('/')) ??
    changes[0];
  const raw = primary?.entity ?? 'generated';
  const safe = raw
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    .toLowerCase();
  return `agent_${safe || 'generated'}.yaml`;
}
