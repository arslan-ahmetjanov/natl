import { simpleGit, type SimpleGit } from 'simple-git';
import type { DiffFile, DiffStatus } from './types.js';

export interface FetchDiffOptions {
  cwd: string;
  baseRef: string;
  headRef?: string;
  git?: SimpleGit;
}

function mapStatus(raw: string): DiffStatus {
  switch (raw) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Collect changed files between baseRef and headRef with unified patches.
 */
export async function fetchDiff(opts: FetchDiffOptions): Promise<DiffFile[]> {
  const git = opts.git ?? simpleGit({ baseDir: opts.cwd });
  const head = opts.headRef ?? 'HEAD';
  const range = `${opts.baseRef}...${head}`;

  const nameStatus = await git.raw(['diff', '--name-status', '-M', range]);
  const lines = nameStatus
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const files: DiffFile[] = [];
  for (const line of lines) {
    const parts = line.split(/\t+/);
    const statusCode = parts[0] ?? 'M';
    const status = mapStatus(statusCode[0] ?? 'M');
    let path: string;
    let oldPath: string | undefined;
    if (status === 'renamed' && parts.length >= 3) {
      oldPath = parts[1];
      path = parts[2]!;
    } else {
      path = parts[1] ?? parts[0]!;
    }
    if (!path || path === statusCode) continue;

    let patch = '';
    try {
      patch = await git.raw(['diff', range, '--', path]);
    } catch {
      patch = '';
    }

    files.push({ path, status, patch, oldPath });
  }

  return files;
}

/** Parse a unified diff string into DiffFile[] (for tests / offline). */
export function parseUnifiedDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const blocks = diffText.split(/^diff --git /m).filter(Boolean);
  for (const block of blocks) {
    const full = `diff --git ${block}`;
    const pathMatch = full.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    if (!pathMatch) continue;
    const oldPath = pathMatch[1]!;
    const path = pathMatch[2]!;
    let status: DiffStatus = 'modified';
    if (/^new file mode/m.test(full)) status = 'added';
    else if (/^deleted file mode/m.test(full)) status = 'deleted';
    else if (/^rename from/m.test(full)) status = 'renamed';
    files.push({
      path,
      status,
      patch: full,
      oldPath: oldPath !== path ? oldPath : undefined,
    });
  }
  return files;
}
