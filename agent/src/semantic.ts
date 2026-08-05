import { extname } from 'node:path';
import type {
  ChangeType,
  CodeEntity,
  DiffFile,
  RiskLevel,
  SupportedLanguage,
  UirChange,
} from './types.js';
import { extractEntitiesTreeSitter } from './treesitter.js';

export type { CodeEntity };

const EXT_LANG: Record<string, SupportedLanguage> = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.java': 'java',
  '.go': 'go',
  '.cs': 'csharp',
};

export function detectLanguage(filePath: string): SupportedLanguage {
  return EXT_LANG[extname(filePath).toLowerCase()] ?? 'unknown';
}

const EXTRACTORS: Record<
  Exclude<SupportedLanguage, 'unknown'>,
  RegExp[]
> = {
  python: [
    /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm,
    /^\s*class\s+([A-Za-z_][\w]*)\s*(?:\([^)]*\))?:/gm,
  ],
  javascript: [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gm,
    /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm,
  ],
  typescript: [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/gm,
    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm,
  ],
  java: [
    /^\s*(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm,
    /^\s*(?:public|private|protected)?\s*(?:abstract\s+|final\s+)?class\s+([A-Za-z_][\w]*)/gm,
  ],
  go: [
    /^\s*func\s+(?:\([^)]+\)\s+)?([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm,
    /^\s*type\s+([A-Za-z_][\w]*)\s+struct\b/gm,
  ],
  csharp: [
    /^\s*(?:public|private|protected|internal|static|\s)+[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm,
    /^\s*(?:public|private|protected|internal)?\s*(?:abstract\s+|sealed\s+|static\s+)?class\s+([A-Za-z_][\w]*)/gm,
  ],
};

/** Regex-based entity extraction (fallback when Tree-sitter unavailable). */
export function extractEntitiesHeuristic(
  source: string,
  language: SupportedLanguage,
): CodeEntity[] {
  if (language === 'unknown') return [];
  const patterns = EXTRACTORS[language];
  const out: CodeEntity[] = [];
  const seen = new Set<string>();

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const name = m[1]!;
      const sig = m[0]!.trim();
      const kind: CodeEntity['kind'] = /\bclass\b|\bstruct\b/i.test(sig)
        ? 'class'
        : 'function';
      const key = `${kind}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, name, signature: sig.slice(0, 200) });
    }
  }
  return out;
}

/** Split unified patch into old (-) and new (+) bodies (approx). */
export function splitPatchBodies(patch: string): { oldBody: string; newBody: string } {
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (const line of patch.split(/\r?\n/)) {
    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('@@')
    ) {
      continue;
    }
    if (line.startsWith('-')) oldLines.push(line.slice(1));
    else if (line.startsWith('+')) newLines.push(line.slice(1));
    else if (line.startsWith(' ')) {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    }
  }
  return { oldBody: oldLines.join('\n'), newBody: newLines.join('\n') };
}

function riskFor(changeType: ChangeType, language: SupportedLanguage): RiskLevel {
  if (language === 'unknown') return 'LOW';
  if (
    changeType.endsWith('_REMOVED') ||
    changeType === 'FUNCTION_CHANGED' ||
    changeType === 'CLASS_CHANGED'
  ) {
    return 'HIGH';
  }
  if (changeType.endsWith('_ADDED')) return 'MEDIUM';
  return 'LOW';
}

function describe(changeType: ChangeType, entity: string, detail?: string): string {
  const base = `${changeType.replace(/_/g, ' ').toLowerCase()}: ${entity}`;
  return detail ? `${base} — ${detail}` : base;
}

export function compareEntityMaps(
  file: string,
  language: SupportedLanguage,
  oldEnt: CodeEntity[],
  newEnt: CodeEntity[],
): UirChange[] {
  const changes: UirChange[] = [];
  const oldMap = new Map(oldEnt.map((e) => [`${e.kind}:${e.name}`, e]));
  const newMap = new Map(newEnt.map((e) => [`${e.kind}:${e.name}`, e]));

  for (const [key, ent] of newMap) {
    const prev = oldMap.get(key);
    if (!prev) {
      const changeType: ChangeType =
        ent.kind === 'class' ? 'CLASS_ADDED' : 'FUNCTION_ADDED';
      changes.push({
        file,
        language,
        changeType,
        entity: ent.name,
        description: describe(changeType, ent.name, ent.signature),
        risk: riskFor(changeType, language),
        detail: ent.signature,
      });
    } else if (prev.signature !== ent.signature) {
      const changeType: ChangeType =
        ent.kind === 'class' ? 'CLASS_CHANGED' : 'FUNCTION_CHANGED';
      changes.push({
        file,
        language,
        changeType,
        entity: ent.name,
        description: describe(
          changeType,
          ent.name,
          `${prev.signature} → ${ent.signature}`,
        ),
        risk: riskFor(changeType, language),
        detail: ent.signature,
      });
    }
  }

  for (const [key, ent] of oldMap) {
    if (newMap.has(key)) continue;
    const changeType: ChangeType =
      ent.kind === 'class' ? 'CLASS_REMOVED' : 'FUNCTION_REMOVED';
    changes.push({
      file,
      language,
      changeType,
      entity: ent.name,
      description: describe(changeType, ent.name, ent.signature),
      risk: riskFor(changeType, language),
      detail: ent.signature,
    });
  }

  return changes;
}

/**
 * Synchronous heuristic semantic diff → UIR (always available).
 */
export function analyzeSemanticDiff(files: DiffFile[]): UirChange[] {
  const changes: UirChange[] = [];

  for (const file of files) {
    const language = detectLanguage(file.path);
    if (file.status === 'deleted') {
      changes.push({
        file: file.path,
        language,
        changeType: 'FILE_REMOVED',
        entity: file.path,
        description: describe('FILE_REMOVED', file.path),
        risk: riskFor('FILE_REMOVED', language),
      });
      continue;
    }

    if (file.status === 'added' && !file.patch) {
      changes.push({
        file: file.path,
        language,
        changeType: 'FILE_ADDED',
        entity: file.path,
        description: describe('FILE_ADDED', file.path),
        risk: riskFor('FILE_ADDED', language),
      });
      continue;
    }

    const { oldBody, newBody } = splitPatchBodies(file.patch);
    const fileChanges = compareEntityMaps(
      file.path,
      language,
      extractEntitiesHeuristic(oldBody, language),
      extractEntitiesHeuristic(newBody, language),
    );
    changes.push(...fileChanges);

    if (!changes.some((c) => c.file === file.path) && language !== 'unknown') {
      changes.push({
        file: file.path,
        language,
        changeType: 'FILE_CHANGED',
        entity: file.path,
        description: describe('FILE_CHANGED', file.path),
        risk: 'MEDIUM',
      });
    }
  }

  return changes;
}

/** Prefer Tree-sitter; fall back to heuristic. */
async function extractEntitiesPreferTreeSitter(
  source: string,
  language: SupportedLanguage,
): Promise<CodeEntity[]> {
  const ts = await extractEntitiesTreeSitter(source, language);
  if (ts && ts.length > 0) return ts;
  return extractEntitiesHeuristic(source, language);
}

/**
 * Tree-sitter-first semantic diff → UIR, with heuristic fallback per file.
 */
export async function analyzeSemanticDiffAsync(
  files: DiffFile[],
): Promise<UirChange[]> {
  const changes: UirChange[] = [];

  for (const file of files) {
    const language = detectLanguage(file.path);
    if (file.status === 'deleted') {
      changes.push({
        file: file.path,
        language,
        changeType: 'FILE_REMOVED',
        entity: file.path,
        description: describe('FILE_REMOVED', file.path),
        risk: riskFor('FILE_REMOVED', language),
      });
      continue;
    }

    if (file.status === 'added' && !file.patch) {
      changes.push({
        file: file.path,
        language,
        changeType: 'FILE_ADDED',
        entity: file.path,
        description: describe('FILE_ADDED', file.path),
        risk: riskFor('FILE_ADDED', language),
      });
      continue;
    }

    const { oldBody, newBody } = splitPatchBodies(file.patch);
    const [oldEnt, newEnt] = await Promise.all([
      extractEntitiesPreferTreeSitter(oldBody, language),
      extractEntitiesPreferTreeSitter(newBody, language),
    ]);
    const fileChanges = compareEntityMaps(
      file.path,
      language,
      oldEnt,
      newEnt,
    );
    changes.push(...fileChanges);

    if (!changes.some((c) => c.file === file.path) && language !== 'unknown') {
      changes.push({
        file: file.path,
        language,
        changeType: 'FILE_CHANGED',
        entity: file.path,
        description: describe('FILE_CHANGED', file.path),
        risk: 'MEDIUM',
      });
    }
  }

  return changes;
}
