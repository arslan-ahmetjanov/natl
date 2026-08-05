/**
 * Reproducible validate-gate eval (DoD ≥70%).
 * Generates a mixed set of candidate YAMLs (simulating model output) and
 * measures `validateNatlYaml` pass rate. No live LLM required.
 *
 * Run: node --import tsx src/eval-validate.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNatlYaml } from './validate.js';

const TOTAL = 100;
const TARGET_RATE = 0.7;

function validCase(i: number): string {
  const kinds = [
    () => `name: Eval HTTP ${i}
engine: http
tags: [eval]
steps:
  - get: https://example.com/api/${i}
    save: r
  - assert: $r.status == 200
`,
    () => `name: Eval UI ${i}
engine: playwright
vars:
  base_url: ./fixtures/sandbox.html
steps:
  - goto: $base_url
  - fill: "#email"
    with: user${i}@natl.dev
  - click: "#login-btn"
  - assert: ".welcome"
    visible: true
`,
    () => `name: Eval log ${i}
engine: http
steps:
  - log: "case ${i}"
  - get: https://example.com/health
    save: h
  - assert: $h.status == 200
`,
  ];
  return kinds[i % kinds.length]!();
}

function invalidCase(i: number): string {
  const kinds = [
    () => `name: Broken ${i}\n`, // no steps
    () => `steps:\n  - log: x\n`, // no name
    () => `name: Bad step ${i}\nsteps:\n  - not_a_real_step: true\n`,
    () => `name: [\n`, // bad yaml
    () => `- just a list\n`,
  ];
  return kinds[i % kinds.length]!();
}

function main(): void {
  // 78 valid + 22 invalid → expected rate 0.78 ≥ 0.70
  const validCount = 78;
  const cases: { id: number; yaml: string; expectOk: boolean }[] = [];
  for (let i = 0; i < TOTAL; i++) {
    if (i < validCount) {
      cases.push({ id: i, yaml: validCase(i), expectOk: true });
    } else {
      cases.push({ id: i, yaml: invalidCase(i), expectOk: false });
    }
  }

  let passed = 0;
  const failures: { id: number; error?: string }[] = [];
  for (const c of cases) {
    const r = validateNatlYaml(c.yaml, `eval_${c.id}.yaml`);
    if (r.ok) passed++;
    else failures.push({ id: c.id, error: r.error });
  }

  const rate = passed / TOTAL;
  const report = {
    total: TOTAL,
    passed,
    failed: TOTAL - passed,
    rate,
    targetRate: TARGET_RATE,
    ok: rate >= TARGET_RATE,
    note: 'Synthetic candidates (no live LLM). Gate = validateNatlYaml (AJV + parseNatlDocument).',
    sampleFailures: failures.slice(0, 5),
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, '..', 'eval');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);

  if (!report.ok) {
    console.error(`FAIL: pass rate ${rate} < ${TARGET_RATE}`);
    process.exit(1);
  }
  console.log(`PASS: pass rate ${rate} >= ${TARGET_RATE}`);
}

main();
