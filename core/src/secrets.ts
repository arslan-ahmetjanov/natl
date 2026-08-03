import { config as loadDotenv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import type { SecretsConfig } from './types.js';

export class SecretsStore {
  private readonly values = new Map<string, string>();
  private readonly masked = new Set<string>();

  loadEnvFile(filePath: string, encoding: BufferEncoding = 'utf-8'): void {
    const abs = isAbsolute(filePath) ? filePath : resolve(filePath);
    if (!existsSync(abs)) {
      // Soft-fail: missing .env is ok
      return;
    }
    loadDotenv({ path: abs, encoding });
    // Also parse manually to track secret values for masking
    const content = readFileSync(abs, encoding);
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      this.values.set(key, val);
      this.masked.add(val);
      process.env[key] = val;
    }
  }

  fromConfig(secrets: SecretsConfig | undefined, baseDir: string): void {
    if (!secrets?.env) return;
    const file = secrets.env.file ?? '.env';
    const abs = isAbsolute(file) ? file : resolve(baseDir, file);
    this.loadEnvFile(abs, (secrets.env.encoding as BufferEncoding) || 'utf-8');
  }

  getEnv(key: string): string {
    const v = this.values.get(key) ?? process.env[key];
    if (v === undefined) {
      throw new Error(`Environment variable not found: ${key}`);
    }
    this.masked.add(v);
    return v;
  }

  /** Resolve ${ENV:KEY} (compat), ${VAULT:...}, ${AWS:...} in a string. Prefer `$env.KEY` / `$secret.KEY`. */
  resolveRefs(input: string): string {
    return input.replace(/\$\{(ENV|VAULT|AWS):([^}]+)\}/g, (_m, source: string, key: string) => {
      if (source === 'ENV') {
        return this.getEnv(key.trim());
      }
      // Vault/AWS not in MVP — leave placeholder or throw
      throw new Error(`${source} secrets are not supported in MVP (key: ${key})`);
    });
  }

  resolveDeep(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.resolveRefs(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.resolveDeep(v));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.resolveDeep(v);
      }
      return out;
    }
    return value;
  }

  mask(text: string): string {
    let out = text;
    const sorted = [...this.masked].filter(Boolean).sort((a, b) => b.length - a.length);
    for (const secret of sorted) {
      if (secret.length < 2) continue;
      out = out.split(secret).join('***');
    }
    return out;
  }

  registerSecret(value: string): void {
    if (value) this.masked.add(value);
  }
}

export function loadSecretsForFile(
  secrets: SecretsConfig | undefined,
  sourcePath?: string,
): SecretsStore {
  const store = new SecretsStore();
  const base = sourcePath ? dirname(sourcePath) : process.cwd();
  store.fromConfig(secrets, base);
  // Also try cwd .env
  store.loadEnvFile(resolve(process.cwd(), '.env'));
  return store;
}
