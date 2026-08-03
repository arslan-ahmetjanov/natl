import type { AdapterFactory } from '@natl/core';

/**
 * Known official engine → npm package map.
 * Third-party adapters can still be loaded as `@natl/adapter-<name>`
 * or a fully qualified package via `--engine-package`.
 */
export const OFFICIAL_ENGINES: Record<string, string> = {
  playwright: '@natl/adapter-playwright',
  selenium: '@natl/adapter-selenium',
  cypress: '@natl/adapter-cypress',
};

/** Engines implemented in @natl/core (no adapter package). */
export const BUILTIN_ENGINES = ['http'] as const;

export interface EngineModule {
  engine?: string;
  createAdapter?: AdapterFactory;
  createPlaywrightAdapter?: AdapterFactory;
  default?: AdapterFactory;
}

export async function resolveEnginePackage(
  engine: string,
  enginePackage?: string,
): Promise<string> {
  if (enginePackage) return enginePackage;
  return OFFICIAL_ENGINES[engine] ?? `@natl/adapter-${engine}`;
}

export async function loadAdapterFactory(
  engine: string,
  enginePackage?: string,
): Promise<{ packageName: string; factory: AdapterFactory }> {
  const packageName = await resolveEnginePackage(engine, enginePackage);
  let mod: EngineModule;
  try {
    mod = (await import(packageName)) as EngineModule;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot load engine "${engine}" from package "${packageName}".\n` +
        `Install it: npm install ${packageName}\n` +
        `(${detail})`,
    );
  }

  const factory =
    mod.createAdapter ?? mod.createPlaywrightAdapter ?? mod.default;

  if (typeof factory !== 'function') {
    throw new Error(
      `Package "${packageName}" does not export createAdapter (EngineAdapter factory).`,
    );
  }

  return { packageName, factory };
}

export async function listInstalledEngines(): Promise<
  Array<{ engine: string; packageName: string; installed: boolean }>
> {
  const entries = Object.entries(OFFICIAL_ENGINES);
  const result: Array<{ engine: string; packageName: string; installed: boolean }> = [];
  for (const [engine, packageName] of entries) {
    let installed = false;
    try {
      await import(packageName);
      installed = true;
    } catch {
      installed = false;
    }
    result.push({ engine, packageName, installed });
  }
  return result;
}
