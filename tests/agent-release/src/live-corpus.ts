/**
 * Deterministic sanitized PR-diff corpus for live LLM eval.
 * No secrets, emails, tokens, or real company names — synthetic only.
 */
export interface LiveDiffCase {
  id: number;
  language: string;
  path: string;
  entity: string;
  /** Unified diff text */
  diff: string;
}

type LangSpec = {
  language: string;
  ext: string;
  dir: string;
  make: (entity: string, i: number) => { oldBody: string; newBody: string };
};

const LANGS: LangSpec[] = [
  {
    language: 'python',
    ext: 'py',
    dir: 'src/api',
    make: (entity, i) => ({
      oldBody: `def existing_${i}():\n    return True\n`,
      newBody: `def existing_${i}():\n    return True\n\n\ndef ${entity}(timeout=None):\n    """Fetch resource ${i} (sanitized fixture)."""\n    return {"id": ${i}, "ok": True}\n`,
    }),
  },
  {
    language: 'typescript',
    ext: 'ts',
    dir: 'src/services',
    make: (entity, i) => ({
      oldBody: `export function ping_${i}(): boolean {\n  return true\n}\n`,
      newBody: `export function ping_${i}(): boolean {\n  return true\n}\n\nexport async function ${entity}(id: number): Promise<{ id: number }> {\n  return { id }\n}\n`,
    }),
  },
  {
    language: 'javascript',
    ext: 'js',
    dir: 'lib',
    make: (entity, i) => ({
      oldBody: `function noop_${i}() { return 0 }\n`,
      newBody: `function noop_${i}() { return 0 }\n\nasync function ${entity}(userId) {\n  return { userId, status: 'ok' }\n}\n\nmodule.exports = { ${entity} }\n`,
    }),
  },
  {
    language: 'go',
    ext: 'go',
    dir: 'internal/api',
    make: (entity, i) => {
      const name = entity[0]!.toUpperCase() + entity.slice(1);
      return {
        oldBody: `package api\n\nfunc Ping${i}() error { return nil }\n`,
        newBody: `package api\n\nfunc Ping${i}() error { return nil }\n\nfunc ${name}(id int) (map[string]any, error) {\n\treturn map[string]any{"id": id}, nil\n}\n`,
      };
    },
  },
  {
    language: 'java',
    ext: 'java',
    dir: 'src/main/java/com/example',
    make: (entity, i) => {
      const name = entity[0]!.toUpperCase() + entity.slice(1);
      return {
        oldBody: `public class Service${i} {\n  public boolean ping() { return true; }\n}\n`,
        newBody: `public class Service${i} {\n  public boolean ping() { return true; }\n  public User ${name}(int id) { return new User(id); }\n}\n`,
      };
    },
  },
  {
    language: 'csharp',
    ext: 'cs',
    dir: 'src/Services',
    make: (entity, i) => {
      const name = entity[0]!.toUpperCase() + entity.slice(1);
      return {
        oldBody: `public class Service${i} {\n  public bool Ping() => true;\n}\n`,
        newBody: `public class Service${i} {\n  public bool Ping() => true;\n  public object ${name}(int id) => new { Id = id };\n}\n`,
      };
    },
  },
];

const ENTITY_STEMS = [
  'get_user',
  'create_order',
  'list_items',
  'update_profile',
  'delete_session',
  'fetch_cart',
  'reset_password',
  'search_products',
  'get_invoice',
  'post_comment',
];

function toCamel(stem: string): string {
  return stem.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function unifiedDiff(path: string, oldBody: string, newBody: string): string {
  const oldLines = oldBody.split('\n');
  const newLines = newBody.split('\n');
  // Simple full-file replace hunk (sanitized fixtures are small)
  const hunk = [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
  ];
  return hunk.join('\n');
}

/**
 * Build N sanitized unified-diff cases (default 50).
 * Deterministic for a given N — no network, no PII.
 */
export function buildLiveCorpus(n = 50): LiveDiffCase[] {
  const count = Math.max(1, Math.min(200, Math.floor(n)));
  const out: LiveDiffCase[] = [];
  for (let i = 0; i < count; i++) {
    const lang = LANGS[i % LANGS.length]!;
    const stem = ENTITY_STEMS[i % ENTITY_STEMS.length]!;
    const entity =
      lang.language === 'python' || lang.language === 'javascript'
        ? `${stem}_${i}`
        : `${toCamel(stem)}${i}`;
    const path = `${lang.dir}/${stem}_${i}.${lang.ext}`;
    const { oldBody, newBody } = lang.make(entity, i);
    out.push({
      id: i,
      language: lang.language,
      path,
      entity,
      diff: unifiedDiff(path, oldBody, newBody),
    });
  }
  return out;
}

export const LIVE_CORPUS_DEFAULT_N = 50;
export const LIVE_EVAL_TARGET_DEFAULT = 0.7;
