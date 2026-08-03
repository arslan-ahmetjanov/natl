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
  parseReporterName,
  filterNatlFiles,
  parseTagsCsv,
} from '@natl/core';
import type { AdapterFactory, ArtifactMode, NatFileMeta, ReporterName } from '@natl/core';
import { loadAdapterFactory, listInstalledEngines, OFFICIAL_ENGINES } from './engines.js';
import { cmdInit } from './init.js';

const require = createRequire(import.meta.url);

const ARTIFACT_MODES = new Set<ArtifactMode>(['off', 'on', 'on-fail']);

function parseArtifactModeFlag(raw: string | undefined, flag: string): ArtifactMode {
  if (raw === undefined) throw new Error(`Missing value for ${flag}`);
  if (!ARTIFACT_MODES.has(raw as ArtifactMode)) {
    throw new Error(`Invalid ${flag} "${raw}": expected off, on, or on-fail`);
  }
  return raw as ArtifactMode;
}

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
  --tags <csv>              Run tests with any of these tags (OR)
  --grep <pattern>          Run tests whose name or path matches RegExp
  --reporter <name>         console | junit | json (repeatable; default: console)
  --output <path>           Report file (or dir if both junit+json)
  --force                   Overwrite existing files (init only)
  --help, -h                Show help

Examples:
  natl run tests/ --tags smoke
  natl run tests/ --tags smoke,auth --grep Login
  natl run tests/ --env staging
  natl run tests/ --config config/prod.yaml
  natl run tests/ --retries 2
  natl run tests/ --trace on-fail
  natl run tests/ --trace off --video off
  natl run tests/ --reporter junit --output artifacts/junit.xml
  natl run tests/ --reporter json --output artifacts/report.json
  natl run tests/ --reporter console --reporter junit

Project defaults: nearest natl.config.yaml / natl.config.yml (walk-up from the test file).
Env profiles: config/<env>.yaml relative to the project root (--env), or --config <path>.
Engines are separate packages (e.g. @natl/adapter-playwright).
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

interface CliFlags {
  /** Set only when `--engine` was passed */
  engine?: string;
  enginePackage?: string;
  /** `--env <name>` → config/<name>.yaml */
  env?: string;
  /** Explicit env-profile path (`--config`) */
  config?: string;
  /** Set only when `--headed` was passed */
  headed?: boolean;
  screenshot: boolean;
  /** Set only when `--soft-assert-screenshot` was passed */
  softAssertScreenshot?: boolean;
  /** Set only when `--trace` was passed */
  trace?: ArtifactMode;
  /** Set only when `--video` was passed */
  video?: ArtifactMode;
  /** Set only when `--retries` was passed */
  retries?: number;
  force: boolean;
  reporters: ReporterName[];
  output?: string;
  /** Raw `--tags` CSV */
  tags?: string;
  /** Raw `--grep` pattern */
  grep?: string;
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
  try {
    loadMergedProjectConfig({
      startDir: dirname(allFiles[0]!),
      fallbackDir: process.cwd(),
      env: flags.env,
      configPath: flags.config,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

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

  let failed = 0;
  for (const pe of parseErrorsToReport) {
    failed++;
    await reporter.testFinished({
      name: pe.file,
      path: pe.file,
      ok: false,
      durationMs: 0,
      error: pe.error,
    });
  }

  const adapterCache = new Map<string, { factory: AdapterFactory; packageName: string }>();

  const loadEngine = async (engine: string) => {
    const cached = adapterCache.get(engine);
    if (cached) return cached;
    try {
      const loaded = await loadAdapterFactory(engine, flags.enginePackage);
      adapterCache.set(engine, loaded);
      return loaded;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      const hint = OFFICIAL_ENGINES[engine];
      if (hint) console.error(`Hint: npm install ${hint} && npx playwright install chromium`);
      return null;
    }
  };

  for (const file of files) {
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
      const error = err instanceof Error ? err.message : String(err);
      await reporter.testFinished({ name: file, path: file, ok: false, durationMs: 0, error });
      continue;
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
        await reporter.testFinished({
          name: doc.name ?? file,
          path: file,
          ok: false,
          durationMs: 0,
          error: `Failed to load engine "${settings.engine}"`,
        });
        continue;
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
    });

    const reportOne = async (r: typeof result, path: string) => {
      const name = r.name ?? path;
      if (!r.ok) failed++;
      await reporter.testFinished({
        name,
        path,
        ok: r.ok,
        durationMs: r.durationMs,
        error: r.error,
        attempt: r.attempt,
        attempts: r.attempts,
        flaky: r.flaky,
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
  }

  const totalReported = plannedTotal;
  await reporter.end({
    passed: totalReported - failed,
    failed,
    durationMs: Date.now() - runStarted,
  });
  return failed > 0 ? 1 : 0;
}

function parseFlags(args: string[]): { cmd: string; positional: string[]; flags: CliFlags } {
  const flags: CliFlags = { screenshot: true, force: false, reporters: [] };
  const positional: string[] = [];
  const first = args[0] ?? '';

  const consume = (list: string[], startIndex: number) => {
    for (let i = startIndex; i < list.length; i++) {
      const a = list[i];
      if (a === '--engine') {
        flags.engine = list[++i] ?? flags.engine;
      } else if (a === '--engine-package') {
        flags.enginePackage = list[++i];
      } else if (a === '--env') {
        flags.env = list[++i];
        if (flags.env === undefined) throw new Error('Missing value for --env');
      } else if (a === '--config') {
        flags.config = list[++i];
        if (flags.config === undefined) throw new Error('Missing value for --config');
      } else if (a === '--headed') {
        flags.headed = true;
      } else if (a === '--no-screenshot') {
        flags.screenshot = false;
      } else if (a === '--soft-assert-screenshot') {
        flags.softAssertScreenshot = true;
      } else if (a === '--trace') {
        flags.trace = parseArtifactModeFlag(list[++i], '--trace');
      } else if (a === '--video') {
        flags.video = parseArtifactModeFlag(list[++i], '--video');
      } else if (a === '--retries') {
        const raw = list[++i];
        if (raw === undefined) throw new Error('Missing value for --retries');
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) {
          throw new Error(`Invalid --retries "${raw}": expected a non-negative integer`);
        }
        flags.retries = n;
      } else if (a === '--tags') {
        flags.tags = list[++i];
        if (flags.tags === undefined) throw new Error('Missing value for --tags');
      } else if (a === '--grep') {
        flags.grep = list[++i];
        if (flags.grep === undefined) throw new Error('Missing value for --grep');
      } else if (a === '--reporter') {
        const raw = list[++i];
        if (!raw) throw new Error('Missing value for --reporter');
        flags.reporters.push(parseReporterName(raw));
      } else if (a === '--output') {
        flags.output = list[++i];
        if (!flags.output) throw new Error('Missing value for --output');
      } else if (a === '--force') {
        flags.force = true;
      } else if (!a.startsWith('-')) {
        positional.push(a);
      }
    }
  };

  if (first === 'run' || first === 'validate' || first === 'engines' || first === 'init') {
    consume(args, 1);
    return { cmd: first, positional, flags };
  }

  // Subcommand-less: `natl [--flags] file.yaml`
  consume(args, 0);
  return { cmd: positional[0] ?? first, positional, flags };
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
