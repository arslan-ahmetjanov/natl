import { parseReporterName } from '@natl/core';
import type { ArtifactMode, ReporterName } from '@natl/core';

const ARTIFACT_MODES = new Set<ArtifactMode>(['off', 'on', 'on-fail']);

export function parseArtifactModeFlag(raw: string | undefined, flag: string): ArtifactMode {
  if (raw === undefined) throw new Error(`Missing value for ${flag}`);
  if (!ARTIFACT_MODES.has(raw as ArtifactMode)) {
    throw new Error(`Invalid ${flag} "${raw}": expected off, on, or on-fail`);
  }
  return raw as ArtifactMode;
}

export interface CliFlags {
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
  /** Set only when `--workers` was passed */
  workers?: number;
  failFast?: boolean;
  /** Stop after this many failed tests (cases / files) */
  maxFailures?: number;
  /** 1-based shard index and total */
  shard?: { index: number; total: number };
  force: boolean;
  reporters: ReporterName[];
  output?: string;
  /** Raw `--tags` CSV */
  tags?: string;
  /** Raw `--grep` pattern */
  grep?: string;
}

export function parseShardFlag(raw: string | undefined): { index: number; total: number } {
  if (raw === undefined) throw new Error('Missing value for --shard');
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(raw.trim());
  if (!m) {
    throw new Error(`Invalid --shard "${raw}": expected index/total (e.g. 1/3)`);
  }
  const index = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1) {
    throw new Error(`Invalid --shard "${raw}": total must be an integer >= 1`);
  }
  if (index < 1 || index > total) {
    throw new Error(`Invalid --shard "${raw}": index must be between 1 and ${total}`);
  }
  return { index, total };
}

/** Keep files where `i % total === index - 1` (stable, covers the full list across shards). */
export function selectShardFiles(files: string[], index: number, total: number): string[] {
  return files.filter((_, i) => i % total === index - 1);
}

export function parseFlags(args: string[]): { cmd: string; positional: string[]; flags: CliFlags } {
  const flags: CliFlags = { screenshot: true, force: false, reporters: [] };
  const positional: string[] = [];
  const first = args[0] ?? '';

  const consume = (list: string[], startIndex: number) => {
    for (let i = startIndex; i < list.length; i++) {
      const a = list[i]!;
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
      } else if (a === '--workers') {
        const raw = list[++i];
        if (raw === undefined) throw new Error('Missing value for --workers');
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`Invalid --workers "${raw}": expected an integer >= 1`);
        }
        flags.workers = n;
      } else if (a === '--fail-fast') {
        flags.failFast = true;
      } else if (a === '--max-failures') {
        const raw = list[++i];
        if (raw === undefined) throw new Error('Missing value for --max-failures');
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`Invalid --max-failures "${raw}": expected an integer >= 1`);
        }
        flags.maxFailures = n;
      } else if (a === '--shard') {
        flags.shard = parseShardFlag(list[++i]);
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
