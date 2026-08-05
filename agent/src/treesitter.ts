import { createRequire } from 'node:module';
import { getWasmPath } from 'tree-sitter-wasm';
import type { CodeEntity, SupportedLanguage } from './types.js';

const require = createRequire(import.meta.url);

type WasmLang =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'go'
  | 'c_sharp';

/** Minimal surface of web-tree-sitter used by the agent. */
interface TsParser {
  setLanguage(lang: unknown): unknown;
  parse(source: string): { rootNode: unknown; delete(): void } | null;
  delete(): void;
}
interface TsModule {
  Parser: {
    init(opts?: { locateFile?: (name: string) => string }): Promise<void>;
    new (): TsParser;
  };
  Language: {
    load(path: string): Promise<unknown>;
  };
  Query: new (
    lang: unknown,
    source: string,
  ) => {
    matches(node: unknown): Array<{
      captures: Array<{ name: string; node: { text: string } }>;
    }>;
    delete(): void;
  };
}

const LANG_TO_WASM: Record<Exclude<SupportedLanguage, 'unknown'>, WasmLang> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  go: 'go',
  csharp: 'c_sharp',
};

const DEF_QUERIES: Record<WasmLang, string> = {
  python: `
(function_definition name: (identifier) @name) @definition.function
(class_definition name: (identifier) @name) @definition.class
`,
  javascript: `
(function_declaration name: (identifier) @name) @definition.function
(generator_function_declaration name: (identifier) @name) @definition.function
(class_declaration name: (identifier) @name) @definition.class
(method_definition name: (property_identifier) @name) @definition.method
(lexical_declaration (variable_declarator name: (identifier) @name value: [(arrow_function) (function_expression)])) @definition.function
`,
  typescript: `
(function_declaration name: (identifier) @name) @definition.function
(class_declaration name: (type_identifier) @name) @definition.class
(method_definition name: (property_identifier) @name) @definition.method
(lexical_declaration (variable_declarator name: (identifier) @name value: [(arrow_function) (function_expression)])) @definition.function
`,
  java: `
(method_declaration name: (identifier) @name) @definition.method
(class_declaration name: (identifier) @name) @definition.class
`,
  go: `
(function_declaration name: (identifier) @name) @definition.function
(method_declaration name: (field_identifier) @name) @definition.method
(type_declaration (type_spec name: (type_identifier) @name type: (struct_type))) @definition.class
`,
  c_sharp: `
(method_declaration name: (identifier) @name) @definition.method
(class_declaration name: (identifier) @name) @definition.class
`,
};

let parserReady: Promise<TsModule> | null = null;
const languageCache = new Map<WasmLang, unknown>();

async function ensureParser(): Promise<TsModule> {
  if (!parserReady) {
    parserReady = (async () => {
      const mod = (await import('web-tree-sitter')) as unknown as TsModule;
      const coreWasm = require.resolve('web-tree-sitter/tree-sitter.wasm');
      await mod.Parser.init({
        locateFile: (scriptName: string) =>
          scriptName === 'tree-sitter.wasm' ? coreWasm : scriptName,
      });
      return mod;
    })();
  }
  return parserReady;
}

async function loadLanguage(wasmLang: WasmLang): Promise<unknown> {
  if (languageCache.has(wasmLang)) return languageCache.get(wasmLang);
  const mod = await ensureParser();
  const wasmPath = getWasmPath(wasmLang);
  const lang = await mod.Language.load(wasmPath);
  languageCache.set(wasmLang, lang);
  return lang;
}

function kindFromCapture(captureName: string): CodeEntity['kind'] {
  if (captureName.includes('class')) return 'class';
  return 'function';
}

/**
 * Extract entities via Tree-sitter WASM. Returns null if unavailable / parse fails.
 */
export async function extractEntitiesTreeSitter(
  source: string,
  language: SupportedLanguage,
): Promise<CodeEntity[] | null> {
  if (language === 'unknown' || !source.trim()) return null;
  const wasmLang = LANG_TO_WASM[language];
  try {
    const mod = await ensureParser();
    const lang = await loadLanguage(wasmLang);
    const parser = new mod.Parser();
    parser.setLanguage(lang);
    const tree = parser.parse(source);
    if (!tree) {
      parser.delete();
      return null;
    }
    const query = new mod.Query(lang, DEF_QUERIES[wasmLang]);
    const matches = query.matches(tree.rootNode);
    const out: CodeEntity[] = [];
    const seen = new Set<string>();

    for (const m of matches) {
      let name = '';
      let kind: CodeEntity['kind'] = 'function';
      let nodeText = '';
      for (const cap of m.captures) {
        if (cap.name === 'name') {
          name = cap.node.text;
        } else if (cap.name.startsWith('definition.')) {
          kind = kindFromCapture(cap.name);
          nodeText = cap.node.text.split('\n')[0]!.trim().slice(0, 200);
        }
      }
      if (!name) continue;
      const key = `${kind}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind,
        name,
        signature: nodeText || name,
      });
    }

    query.delete();
    tree.delete();
    parser.delete();
    return out;
  } catch {
    return null;
  }
}

/** Simple import path scan for Context Builder. */
export function extractImportHints(source: string): string[] {
  const hints = new Set<string>();
  const patterns = [
    /(?:from|import)\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s+[\w.*]+\s+['"]([^'"]+)['"]/gm,
    /^\s*using\s+([\w.]+)\s*;/gm,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const p = m[1]!;
      if (p.startsWith('.') || p.includes('/')) hints.add(p);
    }
  }
  return [...hints];
}
