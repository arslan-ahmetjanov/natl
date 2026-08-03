import type { NatFileMeta } from './types.js';

export interface FilterNatlFilesOptions {
  /** Absolute (or any) paths of collected YAML files */
  files: string[];
  /** Parsed docs keyed by the same path strings as `files` */
  docs: Map<string, NatFileMeta>;
  /**
   * CSV / list of tags. OR semantics: keep if the scenario has any listed tag.
   * Empty / omitted → no tag filter.
   */
  tags?: string[];
  /**
   * RegExp source matched against scenario `name` or file path.
   * Empty / omitted → no grep filter.
   */
  grep?: string;
}

export interface FilterNatlFilesResult {
  files: string[];
  /** Human-readable reason when nothing matched (for CLI exit 1) */
  emptyReason?: string;
}

/** Parse `--tags smoke,auth` / `--tags smoke` into a non-empty list (trimmed). */
export function parseTagsCsv(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function matchesTags(doc: NatFileMeta, required: string[]): boolean {
  if (!required.length) return true;
  const have = new Set((doc.tags ?? []).map((t) => t.trim()).filter(Boolean));
  return required.some((t) => have.has(t));
}

export function matchesGrep(doc: NatFileMeta, filePath: string, pattern: RegExp): boolean {
  const name = doc.name ?? '';
  return pattern.test(name) || pattern.test(filePath);
}

/**
 * Filter collected test files by `--tags` (OR) and/or `--grep` (name or path).
 */
export function filterNatlFiles(opts: FilterNatlFilesOptions): FilterNatlFilesResult {
  const tagList = (opts.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const grepRaw = opts.grep?.trim() ?? '';

  let grepRe: RegExp | undefined;
  if (grepRaw) {
    try {
      grepRe = new RegExp(grepRaw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid --grep pattern: ${msg}`);
    }
  }

  if (!tagList.length && !grepRe) {
    return { files: [...opts.files] };
  }

  const out = opts.files.filter((file) => {
    const doc = opts.docs.get(file);
    if (!doc) return false;
    if (tagList.length && !matchesTags(doc, tagList)) return false;
    if (grepRe && !matchesGrep(doc, file, grepRe)) return false;
    return true;
  });

  if (out.length > 0) {
    return { files: out };
  }

  const parts: string[] = [];
  if (tagList.length) parts.push(`tags [${tagList.join(', ')}] (OR)`);
  if (grepRaw) parts.push(`grep /${grepRaw}/`);
  return {
    files: [],
    emptyReason: `No tests matched filter: ${parts.join(' and ')} (${opts.files.length} file(s) scanned)`,
  };
}
