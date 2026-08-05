# Public API 1.0

Contract for `@natl/core` **1.0**, official adapters, and `@natl/cli`.  
Semver: **breaking** = anything listed here that changes incompatibly without a major bump.

**Not covered by this freeze:** `@natl/adapter-cypress` (experimental), language wave 6+ (see [`canon.md`](./canon.md)), TMS.

---

## Breaking-change policy

After `1.0.0`, a **major** is required for:

- Removing or renaming a **stable** export from `@natl/core` `exports["."]`
- Changing `EngineAdapter` / `AdapterFactory` / `AdapterFactoryOptions` in a way that breaks existing adapters
- Changing `Reporter` hooks or `ReporterTestResult` required fields so existing reporters break
- Removing or renaming a **stable** CLI command / flag (listed below)
- Changing JSON Schema IDs or removing documented `natl.config` / test root fields without a migration path
- Dropping Node `<18` support only with a major (engines already `>=18`)

**Non-breaking (minor/patch):** new optional adapter methods, new optional reporter fields, new CLI flags with defaults preserving old behavior, new YAML steps that old runners ignore only if documented as additive, deprecations that still work.

**Experimental (may break in minor):** Cypress adapter APIs and behavior.

---

## `@natl/core` stable exports

Entry: package root (`import { … } from '@natl/core'`). Schemas: `@natl/core/schemas/*`.

### Parse / run

| Export | Role |
|--------|------|
| `parseNatlFile` / `parseNatlDocument` / `normalizeStep` / `resolveImportPath` | YAML → AST |
| `preprocessNatlSource` / `preprocessNatlSourceWithMap` | Compact-line preprocessor |
| `runNatlFile` | Execute scenario |
| `AssertError` / `SoftAssertError` / `resolveDoTarget` / `caseDisplayName` | Runtime helpers |
| `RunOptions` / `RunResult` / `SoftAssertFailure` | Types |

### Config

| Export | Role |
|--------|------|
| `findProjectConfigPath` / `loadProjectConfig` / `loadProjectConfigFile` / `loadMergedProjectConfig` / `mergeProjectConfigs` / `parseProjectConfig` / `resolveEnvProfilePath` / `resolveRunSettings` | Project + env overlays |
| `NatlProjectConfig` / `CliRunOverrides` / `ResolvedRunSettings` / … | Types |

### Expressions / secrets

| Export | Role |
|--------|------|
| `ExpressionEngine` / `evaluateExpression` | `$vars`, conditions |
| `SecretsStore` / `loadSecretsForFile` | `$env` / `$secret` / `${ENV:}` + dotenv (no Vault/AWS in-core) |

### HTTP

| Export | Role |
|--------|------|
| `httpRequest` | Low-level HTTP used by `engine: http` / `with: http` |

### Reporters

| Export | Role |
|--------|------|
| `Reporter` (+ start / testFinished / end; optional `stepStart` / `stepEnd`) | Interface |
| `ConsoleReporter` / `JUnitReporter` / `JsonReporter` / `AllureReporter` / `MultiReporter` | Built-ins |
| `createReporters` / `parseReporterName` / `allureHistoryId` | Factories |
| `ReporterTestResult` fields | `name`, `path`, `ok`, `durationMs`, optional `error`, `attempt`, `attempts`, `flaky`, `tags`, `engine`, `attachments`, `steps` |

### Locators / adapter contract

| Export | Role |
|--------|------|
| `EngineAdapter` / `AdapterFactory` / `AdapterFactoryOptions` / `LocatorRef` / artifact types | UI engine contract v2 |
| `resolveLocator` / `normalizeElementsMap` / … | Locator helpers |
| Types from `./types` (`NatFileMeta`, `Step`, …) | AST |

---

## `EngineAdapter` (stable methods)

Required: `goto`, `click`, `fill`, `select`, `check`, `uncheck`, `wait`, `waitMs`, `screenshot`, `getText`, `getAttr`, `isVisible`, `getCurrentUrl`, `scroll`, `swipe`, `longPress`, `dispose`.

Optional: `finalizeArtifacts` (omit or no-op + warn if engine has no trace/video).

Unsupported capabilities **must throw** a clear error (never silent success).

`browser` / `viewport` in factory opts are opaque to core; each adapter documents its ids.

---

## YAML language (stable ~90%)

Documented in [`syntax.md`](./syntax.md) / [`canon.md`](./canon.md): compact steps, `elements` / `actions` / `do:`, `cases:`, soft assert, tags, `engine:`, `with: http`, HTTP verbs.

### Deprecated (still work in 1.0)

| Prefer | Still accepted |
|--------|----------------|
| `get` / `post` / … or `with: http` | Root / step `api:` object |
| `$env.KEY` / `$secret.KEY` | `${ENV:KEY}` |

Do **not** grow a parallel fat `api:` dialect; new HTTP features go to `http` / verbs.

---

## CLI (`@natl/cli`) stable surface

Commands: `init`, `run`, `validate`, `engines`, `--version` / `--help`.

Stable flags (behavior-preserving defaults):  
`--engine`, `--engine-package`, `--env`, `--config`, `--headed`, `--no-screenshot`, `--soft-assert-screenshot`, `--trace`, `--video`, `--retries`, `--workers`, `--fail-fast`, `--max-failures`, `--shard`, `--tags`, `--grep`, `--reporter` (repeatable), `--output`, `--force` (init).

Reporters: `console` | `junit` | `json` | `allure`.

---

## Official adapters

| Package | Freeze |
|---------|--------|
| `@natl/adapter-playwright` | Stable for 1.0 pilots |
| `@natl/adapter-selenium` | Stable **with limits** (no Trace Viewer / video) |
| `@natl/adapter-cypress` | **Experimental** — not part of 1.0 stability promise |

Peer: `@natl/core` `^1.0.0`.

---

## Migration from 0.1.x

1.0.0 is intentionally **compatible** with pilot scenarios written against **0.1.5–0.1.7**:

- Bump installs: `npm i -g @natl/cli@^1 @natl/adapter-playwright@^1`
- No required YAML rewrites for Playwright happy-path
- Optional: replace `api:` with HTTP verbs / `with: http`
- Secrets: only env / `.env` (Vault/AWS refs already rejected)

See root [`CHANGELOG.md`](../../CHANGELOG.md).
