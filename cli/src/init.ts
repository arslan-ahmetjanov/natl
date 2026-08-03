import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_FILES = [
  'natl.config.yaml',
  'tests/example.yaml',
  '.env.example',
  '.gitignore',
  'README.md',
] as const;

function templatesRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
}

function listTemplateFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) {
        walk(abs, rel);
      } else {
        out.push(rel.replace(/\\/g, '/'));
      }
    }
  };
  walk(root, '');
  return out.sort();
}

export interface InitOptions {
  targetDir: string;
  force: boolean;
}

export function cmdInit(opts: InitOptions): number {
  const destRoot = resolve(opts.targetDir);
  const srcRoot = templatesRoot();

  if (!existsSync(srcRoot)) {
    console.error(`NATL templates not found at ${srcRoot}`);
    return 1;
  }

  mkdirSync(destRoot, { recursive: true });

  const files = listTemplateFiles(srcRoot);
  if (!files.length) {
    console.error(`No template files in ${srcRoot}`);
    return 1;
  }

  // Prefer known set; fall back to whatever is on disk
  const planned = TEMPLATE_FILES.filter((f) => files.includes(f));
  const extra = files.filter((f) => !(TEMPLATE_FILES as readonly string[]).includes(f));
  const toWrite = [...planned, ...extra];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const rel of toWrite) {
    const from = join(srcRoot, rel);
    const to = join(destRoot, rel);
    if (existsSync(to) && !opts.force) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(from));
    created.push(rel);
  }

  const rel = relative(process.cwd(), destRoot);
  const label = !rel || rel.startsWith('..') ? destRoot : rel;
  console.log(`NATL project initialized in ${label || '.'}`);

  if (created.length) {
    console.log('\nCreated:');
    for (const f of created) console.log(`  ${f}`);
  }
  if (skipped.length) {
    console.log('\nSkipped (already exists, use --force to overwrite):');
    for (const f of skipped) console.log(`  ${f}`);
  }

  const cdTarget = label || '.';
  console.log(`
Next steps:
  cd ${cdTarget}
  npm install @natl/cli @natl/adapter-playwright
  npx playwright install chromium
  natl run tests/
`);

  return 0;
}
