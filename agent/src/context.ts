import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ContextExample, UirChange } from './types.js';

const YAML_EXT = new Set(['.yaml', '.yml', '.natl']);

function walkYamlFiles(root: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkYamlFiles(full, out);
    else {
      const lower = name.toLowerCase();
      const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
      if (YAML_EXT.has(ext)) out.push(full);
    }
  }
}

/**
 * Find existing NATL YAML that mention changed entities (simple text RAG).
 */
export function buildContext(opts: {
  cwd: string;
  roots: string[];
  changes: UirChange[];
  maxExamples: number;
  /** Extra tokens from imports / related paths. */
  importHints?: string[];
}): ContextExample[] {
  const files: string[] = [];
  for (const root of opts.roots) {
    const abs = join(opts.cwd, root);
    walkYamlFiles(abs, files);
  }

  const entities = [
    ...new Set(
      opts.changes
        .map((c) => c.entity)
        .filter((e) => e && !e.includes('/') && !e.includes('\\')),
    ),
  ];
  const importBits = (opts.importHints ?? [])
    .map((h) => h.replace(/^\.\//, '').split('/').pop() ?? h)
    .filter(Boolean);

  const scored: ContextExample[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!/^\s*name\s*:/m.test(content) || !/^\s*steps\s*:/m.test(content)) {
      continue;
    }
    let score = 0;
    const lower = content.toLowerCase();
    for (const ent of entities) {
      if (lower.includes(ent.toLowerCase())) score += 3;
    }
    for (const bit of importBits) {
      if (lower.includes(bit.toLowerCase())) score += 1;
    }
    if (content.includes('goto:') || content.includes('assert:')) score += 1;
    if (score > 0) {
      scored.push({
        path: relative(opts.cwd, file).replace(/\\/g, '/'),
        content: content.slice(0, 4000),
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored.slice(0, Math.max(0, opts.maxExamples));
}
