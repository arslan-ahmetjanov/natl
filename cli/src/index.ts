#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readdirSync, statSync } from 'node:fs';
import { resolve, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runNatlFile,
  parseNatlFile,
  loadMergedProjectConfig,
  resolveRunSettings,
  createReporters,
  filterNatlFiles,
  parseTagsCsv,
} from '@natl/core';
import type { AdapterFactory, NatFileMeta } from '@natl/core';
import { loadAdapterFactory, listInstalledEngines, OFFICIAL_ENGINES } from './engines.js';
import { cmdInit } from './init.js';
import { parseFlags, selectShardFiles, type CliFlags } from './flags.js';

const require = createRequire(import.meta.url);

function getVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const pkg = require(pkgPath) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  console.log(`NATL — Not Another Testing Language  v${getVersion()}

Usage:
  natl init [dir] [--force]   Scaffold natl.config.yaml + example test
  natl run <file-or-dir> [options]
  natl validate <file-or-dir>
  natl engines
  natl --version

Options:
  --engine <name>           Engine id (overrides natl.config / test YAML)
  --engine-package <pkg>    Override npm package for the engine
  --env <name>              Load config/<name>.yaml over natl.config.yaml
  --config <path>           Load an env-profile YAML over natl.config.yaml
  --headed                  Run browser headed (overrides natl.config headless)
  --no-screenshot           Do not capture a screenshot on failure
  --soft-assert-screenshot  Screenshot on each soft assert failure
  --trace <mode>            Playwright trace: off | on | on-fail (default: on-fail)
  --video <mode>            Playwright video: off | on | on-fail (default: off)
  --retries <n>             Extra full-scenario attempts after failure (default 0)
  --workers <n>             Run scenario files in parallel (default 1)
  --fail-fast               Stop scheduling after the first failed file
  --max-failures <n>        Stop scheduling after N failed tests
  --shard <index>/<total>   Run a deterministic slice of files (e.g. 1/3)
  --tags <csv>              Run tests with any of these tags (OR)
  --grep <pattern>          Run tests whose name or path matches RegExp
  --reporter <name>         console | junit | json | allure (repeatable; default: console)
  --output <path>           Report file, or results dir for allure (default allure-results)
  --force                   Overwrite existing files (init only)
  --help, -h                Show help

Examples:
  natl run tests/ --tags smoke
  natl run tests/ --tags smoke,auth --grep Login
  natl run tests/ --env staging
  natl run tests/ --config config/prod.yaml
  natl run tests/ --retries 2
  natl run tests/ --workers 2
  natl run tests/ --fail-fast
  natl run tests/ --max-failures 3
  natl run tests/ --shard 1/2 --workers 2
  natl run tests/ --trace on-fail
  natl run tests/ --trace off --video off
  natl run tests/ --reporter junit --output artifacts/junit.xml
  natl run tests/ --reporter json --output artifacts/report.json
  natl run tests/ --reporter console --reporter junit
  natl run tests/ --reporter console --reporter allure --output allure-results

Project defaults: nearest natl.config.yaml / natl.config.yml (walk-up from the test file).
Env profiles: config/<env>.yaml relative to the project root (--env), or --config <path>.
Engines are separate packages (e.g. @natl/adapter-playwright).
--workers runs files concurrently (each file = own browser/session). YAML parallel: steps are unchanged.
Console line order may vary when workers > 1; reporter summary stays accurate.
--fail-fast / --max-failures stop starting new files; in-flight files still finish and report.
--shard splits the filtered file list (1-based index); combine with a CI matrix for parallel jobs.
`);
}

function collectYamlFiles(target: string): string[] {
  const abs = resolve(target);
  const st = statSync(abs);
  if (st.isFile()) {
    return [abs];
  }
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) {
        if (name === 'pages' || name === 'node_modules' || name === 'dist' || name === 'config') continue;
        walk(p);
      } else if (/\.ya?ml$/i.test(extname(name))) {
        if (/^natl\.config\.ya?ml$/i.test(name)) continue;
        if (p.replace(/\\/g, '/').includes('/pages/')) continue;
        out.push(p);
      }
    }
  };
  walk(abs);
  return out;
}

async function cmdValidate(target: string): Promise<number> {
  const files = collectYamlFiles(target);
  if (!files.length) {
    console.error(`No YAML files found at ${target}`);
    return 1;
  }
  let failed = 0;
  for (const file of files) {
    try {
      const doc = parseNatlFile(file);
      console.log(`OK  ${file}${doc.name ? ` (${doc.name})` : ''}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAIL ${file}: ${msg}`);
    }
  }
  console.log(`Validated ${files.length} file(s), ${failed} error(s)`);
  return failed > 0 ? 1 : 0;
}

async function cmdEngines(): Promise<number> {
  const list = await listInstalledEngines();
  console.log('Official engines:\n');
  console.log(`  ✓ ${'http'.padEnd(12)} built-in (@natl/core)`);
  for (const row of list) {
    const mark = row.installed ? '✓' : '·';
    console.log(`  ${mark} ${row.engine.padEnd(12)} ${row.packageName}${row.installed ? '' : '  (not installed)'}`);
  }
  console.log('\nCommunity / custom: install @natl/adapter-<name> or pass --engine-package');
  return 0;
}

/** Run up to `concurrency` async tasks over `items` (stable index order of starts). */
async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  opts?: { shouldContinue?: () => boolean },
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  if (limit <= 1 || items.length <= 1) {
    for (const item of items) {
      if (opts?.shouldContinue && !opts.shouldContinue()) return;
      await fn(item);
    }
    return;
  }
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      if (opts?.shouldContinue && !opts.shouldContinue()) return;
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  });
  await Promise.all(workers);
}

async function cmdRun(target: string, flags: CliFlags): Promise<number> {
  if (flags.env && flags.config) {
    console.error('Use either --env or --config, not both');
    return 1;
  }

  const allFiles = collectYamlFiles(target);
  if (!allFiles.length) {
    console.error(`No YAML test files found at ${target}`);
    return 1;
  }

  // Resolve env profile once (fail fast if missing) against the first test / cwd.
  let suiteConfig;
  try {
    suiteConfig = loadMergedProjectConfig({
      startDir: dirname(allFiles[0]!),
      fallbackDir: process.cwd(),
      env: flags.env,
      configPath: flags.config,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const workers = Math.max(1, flags.workers ?? suiteConfig?.workers ?? 1);

  const tagList = parseTagsCsv(flags.tags);
  const grep = flags.grep?.trim() || undefined;
  const filtering = tagList.length > 0 || Boolean(grep);

  const docs = new Map<string, NatFileMeta>();
  const parseErrors: { file: string; error: string }[] = [];
  for (const file of allFiles) {
    try {
      docs.set(file, parseNatlFile(file));
    } catch (err) {
      parseErrors.push({
        file,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let files: string[];
  try {
    const filtered = filterNatlFiles({
      files: allFiles.filter((f) => docs.has(f)),
      docs,
      tags: tagList,
      grep,
    });
    if (filtering && filtered.files.length === 0) {
      console.error(filtered.emptyReason ?? 'No tests matched filter');
      return 1;
    }
    files = filtered.files;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (flags.shard) {
    const before = files.length;
    files = selectShardFiles(files, flags.shard.index, flags.shard.total);
    if (before > 0 && files.length === 0) {
      console.log(
        `Shard ${flags.shard.index}/${flags.shard.total}: no files in this slice (${before} filtered)`,
      );
      return 0;
    }
  }

  const reporter = createReporters({
    names: flags.reporters,
    output: flags.output,
  });
  const verbose = flags.reporters.length === 0 || flags.reporters.includes('console');
  const runStarted = Date.now();
  const parseErrorsToReport = filtering ? [] : parseErrors;
  let plannedTotal = parseErrorsToReport.length;
  for (const file of files) {
    const d = docs.get(file);
    plannedTotal += d?.cases && d.cases.length > 0 ? d.cases.length : 1;
  }
  await reporter.start({ total: plannedTotal });

  if (verbose && flags.shard) {
    console.log(
      `\n→ shard ${flags.shard.index}/${flags.shard.total}: ${files.length} file(s)`,
    );
  }

  let failed = 0;
  let completed = 0;
  let failedFiles = 0;

  const shouldStopScheduling = () => {
    if (flags.failFast && failedFiles > 0) return true;
    if (flags.maxFailures !== undefined && failed >= flags.maxFailures) return true;
    return false;
  };

  for (const pe of parseErrorsToReport) {
    failed++;
    completed++;
    failedFiles++;
    await reporter.testFinished({
      name: pe.file,
      path: pe.file,
      ok: false,
      durationMs: 0,
      error: pe.error,
    });
    if (shouldStopScheduling()) break;
  }

  const adapterCache = new Map<string, Promise<{ factory: AdapterFactory; packageName: string } | null>>();

  const loadEngine = (engine: string) => {
    const cached = adapterCache.get(engine);
    if (cached) return cached;
    const pending = (async () => {
      try {
        return await loadAdapterFactory(engine, flags.enginePackage);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        const hint = OFFICIAL_ENGINES[engine];
        if (hint) console.error(`Hint: npm install ${hint} && npx playwright install chromium`);
        return null;
      }
    })();
    adapterCache.set(engine, pending);
    return pending;
  };

  // Live step hooks race when workers > 1; Allure/JSON use RunResult.steps instead.
  const stepReporter = workers > 1 ? undefined : reporter;

  const runFile = async (file: string) => {
    let fileHadFailure = false;
    let projectConfig;
    try {
      projectConfig = loadMergedProjectConfig({
        startDir: dirname(file),
        fallbackDir: process.cwd(),
        env: flags.env,
        configPath: flags.config,
      });
    } catch (err) {
      failed++;
      completed++;
      failedFiles++;
      const error = err instanceof Error ? err.message : String(err);
      await reporter.testFinished({ name: file, path: file, ok: false, durationMs: 0, error });
      return;
    }

    const doc = docs.get(file)!;

    const settings = resolveRunSettings({
      config: projectConfig,
      test: { engine: doc.engine, timeout: doc.timeout, retries: doc.retries },
      cli: {
        engine: flags.engine,
        headless: flags.headed === true ? false : undefined,
        retries: flags.retries,
      },
    });

    let adapters: Record<string, AdapterFactory> = {};
    let engineLabel = settings.engine;
    if (settings.engine === 'http') {
      engineLabel = 'http (built-in)';
    } else {
      const loaded = await loadEngine(settings.engine);
      if (!loaded) {
        failed++;
        completed++;
        failedFiles++;
        await reporter.testFinished({
          name: doc.name ?? file,
          path: file,
          ok: false,
          durationMs: 0,
          error: `Failed to load engine "${settings.engine}"`,
        });
        return;
      }
      adapters = { [settings.engine]: loaded.factory };
      engineLabel = `${settings.engine} (${loaded.packageName})`;
    }

    if (verbose) {
      console.log(`\n→ Running ${file}`);
      console.log(`  engine: ${engineLabel}`);
      if (settings.retries > 0) {
        console.log(`  retries: ${settings.retries}`);
      }
      if (doc.tags?.length) {
        console.log(`  tags: ${doc.tags.join(', ')}`);
      }
      if (projectConfig?.path) {
        console.log(`  config: ${projectConfig.path}`);
      }
      if (projectConfig?.profilePath) {
        console.log(`  env profile: ${projectConfig.profilePath}`);
      }
    }

    const result = await runNatlFile({
      file,
      engine: flags.engine,
      headless: flags.headed === true ? false : undefined,
      retries: flags.retries,
      trace: flags.trace,
      video: flags.video,
      projectConfig: projectConfig ?? null,
      adapters,
      screenshot: flags.screenshot,
      softAssertScreenshot: flags.softAssertScreenshot,
      reporter: stepReporter,
    });

    const reportOne = async (r: typeof result, path: string) => {
      const name = r.name ?? path;
      if (!r.ok) {
        failed++;
        fileHadFailure = true;
      }
      completed++;
      const attachments: { name: string; path: string; type: string }[] = [];
      if (r.screenshotPath) {
        attachments.push({ name: 'screenshot', path: r.screenshotPath, type: 'image/png' });
      }
      if (r.tracePath) {
        attachments.push({ name: 'trace', path: r.tracePath, type: 'application/zip' });
      }
      if (r.videoPath) {
        attachments.push({ name: 'video', path: r.videoPath, type: 'video/webm' });
      }
      await reporter.testFinished({
        name,
        path,
        ok: r.ok,
        durationMs: r.durationMs,
        error: r.error,
        attempt: r.attempt,
        attempts: r.attempts,
        flaky: r.flaky,
        tags: doc.tags,
        engine: settings.engine,
        attachments: attachments.length ? attachments : undefined,
        steps: r.steps,
      });
      if (!r.ok && verbose) {
        if (r.screenshotPath) {
          console.error(`  screenshot: ${r.screenshotPath}`);
        }
        if (r.tracePath) {
          console.error(`  trace: ${r.tracePath}`);
        }
        if (r.videoPath) {
          console.error(`  video: ${r.videoPath}`);
        }
      }
    };

    if (result.caseResults && result.caseResults.length > 0) {
      for (const c of result.caseResults) {
        await reportOne(c, file);
      }
    } else {
      await reportOne(result, file);
    }

    if (fileHadFailure) failedFiles++;
  };

  if (verbose && workers > 1) {
    console.log(`\n→ workers: ${workers} (scenario files in parallel)`);
  }

  if (!shouldStopScheduling()) {
    await mapPool(files, workers, runFile, { shouldContinue: () => !shouldStopScheduling() });
  } else if (verbose) {
    console.log('\n→ stop: fail-fast / max-failures (skipping remaining files)');
  }

  await reporter.end({
    passed: completed - failed,
    failed,
    durationMs: Date.now() - runStarted,
  });
  return failed > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--version') || args.includes('-V') || args[0] === 'version') {
    console.log(getVersion());
    process.exit(0);
  }
  if (!args.length || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    printHelp();
    process.exit(0);
  }

  let parsed: { cmd: string; positional: string[]; flags: CliFlags };
  try {
    parsed = parseFlags(args);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const { cmd, positional, flags } = parsed;

  if (cmd === 'engines') {
    process.exit(await cmdEngines());
  }

  if (cmd === 'init') {
    process.exit(
      cmdInit({
        targetDir: positional[0] ?? process.cwd(),
        force: flags.force,
      }),
    );
  }

  const target = cmd === 'run' || cmd === 'validate' ? positional[0] : cmd;
  if (!target && (cmd === 'run' || cmd === 'validate')) {
    console.error('Missing path argument');
    printHelp();
    process.exit(1);
  }

  let code = 0;
  if (cmd === 'run') {
    code = await cmdRun(target!, flags);
  } else if (cmd === 'validate') {
    code = await cmdValidate(target!);
  } else if (target && !cmd.startsWith('-')) {
    code = await cmdRun(target, flags);
  } else {
    printHelp();
    code = 1;
  }
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
