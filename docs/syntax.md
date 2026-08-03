---
layout: default
title: syntax
---

# NATL syntax

NATL is a **short YAML language for web UI + API**. Prefer **compact** steps (what you type by hand). Scenarios are meant to stay stable when you change stand (`--env`), data (`vars` / `cases`), or UI `engine:` / adapter вЂ” browser features follow the adapter, not a hard-coded list in the language.

**Language canon** (principles, ~90% vocabulary, out-of-scope): [canon.md](canon.md).

Supported root fields: `name`, `tags`, `engine`, `timeout`, `retries`, `vars`, `secrets`, `imports`, `data`, `cases`, `before_each`, `after_each`, `steps`, `elements`, `actions`, `locator_strategy`.

## Tags

Optional labels for selecting a subset of tests from the CLI:

```yaml
name: Login smoke
tags: [smoke, auth]
```

```bash
natl run tests/ --tags smoke          # OR: any listed tag
natl run tests/ --tags smoke,auth
natl run tests/ --grep "Login"        # RegExp on name or file path
```

`--tags` uses **OR** (scenario matches if it has at least one of the requested tags). `--tags` and `--grep` combine with AND. If the filter matches zero tests, NATL exits with code 1.

## Retries

Extra full-scenario attempts after a failure (not from the failed step). Each attempt gets a fresh browser context. Final status is **last attempt wins**; JSON may mark `flaky: true` when an earlier attempt failed and a later one passed.

```yaml
name: Flaky checkout
retries: 1
```

```bash
natl run tests/ --retries 2
```

**Merge priority for `retries`:** CLI `--retries` в†’ test YAML `retries:` в†’ `natl.config` `retries:` в†’ `0`.

Failure screenshots / traces / videos use an `-attempt-N` suffix when more than one attempt is configured.

## Project config (`natl.config.yaml`)

Optional file at the project root (also `natl.config.yml`). NATL walks up from the test file directory (then cwd) and loads the nearest match.

```yaml
engine: playwright
browser: chromium          # adapter-specific (Playwright: chromium | firefox | webkit)
timeout: 15000
base_url: https://staging.example.com
headless: true
viewport:                  # optional session hint for the adapter
  width: 1280
  height: 720
artifacts_dir: artifacts
retries: 1
trace: on-fail
video: off
```

| Field | Effect |
|-------|--------|
| `engine` | Default engine when the test omits `engine` |
| `browser` | Opaque browser id passed to the adapter factory (core does not validate) |
| `timeout` | Default step timeout when the test omits `timeout` |
| `base_url` | Injected as `vars.base_url` if the test does not define `vars.base_url` |
| `headless` | Browser headless mode (CLI `--headed` overrides) |
| `viewport` | Optional `{ width, height }` session hint for the adapter |
| `locator_strategy` | Default locator strategy for string elements / inline selectors (`css` \| `xpath`; default `css`) |
| `artifacts_dir` | Screenshot / trace / video directory relative to the scenario (default `artifacts`) |
| `retries` | Extra full-scenario attempts after failure (CLI / test YAML override) |
| `trace` | Playwright trace: `off` \| `on` \| `on-fail` (default `on-fail`; CLI `--trace` overrides) |
| `video` | Playwright video: `off` \| `on` \| `on-fail` (default `off`; CLI `--video` overrides) |

### Env profiles (`config/<env>.yaml`)

Use one test suite against different stands without copying `base_url` into every scenario (same steps, different context):

```text
natl.config.yaml       # shared defaults
config/staging.yaml    # overrides (base_url, headless, вЂ¦)
config/prod.yaml
```

```bash
natl run tests/ --env staging
natl run tests/ --config config/prod.yaml
```

`--env <name>` loads `config/<name>.yaml` (or `.yml`) next to the project root (directory of the nearest `natl.config.*`, else cwd). Missing profile в†’ error exit. `--env` and `--config` are mutually exclusive. Without either flag, behavior matches a plain `natl.config` load.

**Merge priority:** CLI flags (`--engine`, `--headed`, `--retries`, `--trace`, `--video`) в†’ fields in the test YAML в†’ env profile в†’ base project config в†’ built-in defaults.

## Actions

- `goto`, `click` (primary; `tap` is an alias of the same step), `fill`, `select`, `check`, `uncheck`
- `wait` вЂ” explicit only: `hidden` / `attached` / `detached` / `N ms`, or a non-default state. Prefer auto-wait on actions and asserts for вЂњbecome visibleвЂќ.
- `screenshot`
- `assert` вЂ” primary checks (text / contains / visible / hidden / attr / current_url / expression)
- `get_text` / `get_attr` вЂ” save into a var (rare; prefer assert on the locator)
- `scroll` / `swipe` / `long_press` вЂ” web gestures (desktop + mobile web; same scenario)
- `with: <engine>` вЂ” multi-engine block (e.g. `with: http`)
- `get` / `post` / `put` / `patch` / `delete` вЂ” HTTP (prefer over `api:`)
- `api` (GET/POST/вЂ¦) вЂ” **compat**; prefer HTTP verbs + `with: http`
- `set`, `log`, `debug`

### Gestures (desktop + mobile web)

Same steps for any viewport вЂ” no `if: mobile`. Target first; options as siblings.

```yaml
- scroll: "#footer"
  into_view: true
- swipe: "#carousel"
  direction: left
- long_press: "#card"
  duration_ms: 700
```

| Verb | Notes |
|------|--------|
| `scroll` | Into view by default; or `delta_x` / `delta_y` |
| `swipe` | Requires `direction:` (`left` \| `right` \| `up` \| `down`); optional `distance` |
| `long_press` | Optional `duration_ms` (adapter default otherwise) |

Runtime sugar (preprocessor): `scroll: $footer into_view`, `swipe: $el direction: left`.  
`tap` remains an alias of `click` (not a separate gesture). Browsers / touch fidelity = adapter capability.

### Assert (primary)

One rhythm: target + check. Soft is a modifier, not a separate main verb.

```yaml
- assert: ".welcome"
  text: "Hello"
- assert: ".welcome"
  contains: "Hell"
- assert: $welcome
  visible: true
- assert: ".price"
  text: "$10"
  soft: true
# alias (still supported):
- soft_assert: ".price"
  text: "$10"
```

`text:` / `is:` вЂ” exact match on element text (no `get_text` + `save` needed).  
`contains:` вЂ” substring.  
`$el` / POM element vars work as the assert target.  
`soft_assert:` is an alias for `assert` + `soft: true`; prefer the modifier form in new scenarios.

Use `get_text` / `get_attr` only when you need the value in a later expression or log.

### Auto-wait

Locator **actions** (`click` / `tap`, `fill`, вЂ¦) and **asserts** (`text` / `contains` / `visible` / вЂ¦) wait for the target within the step/scenario `timeout`. You do not need:

```yaml
- click: "#login-btn"
- wait: ".welcome visible"   # redundant
- assert: ".welcome"
  text: "Hello"
```

Write:

```yaml
- click: "#login-btn"
- assert: ".welcome"
  text: "Hello"
```

Keep an explicit `wait:` when you need `hidden`, a delay (`2000 ms`), or a state that assert/action does not imply.

### `click` / `tap`

Prefer **`click:`** for desktop and mobile web. **`tap:`** is the same step (normalized to click); Playwright performs a click either way.

## Flow

- `if` / `then` / `else`
- `for: $x in ...` / `range(a,b)` вЂ” complex loops over `data:` or expressions
- `cases:` вЂ” tabular rows; each row runs `steps` with fields in scope (preferred for simple tables)
- `repeat: N times` / `until:`
- `parallel` (Promise.all)
- `do: page.action` вЂ” call a POM named action (happy path)
- `include` вЂ” insert a file or `page/action` steps (lower-level / whole-file reuse)

### `cases:` (data-driven)

```yaml
name: Data-driven login
cases:
  - { name: user1, user: "a@test.com", pass: secret, expect: "Welcome, A" }
  - { name: user2, user: "b@test.com", pass: secret, expect: "Welcome, B" }

steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - fill: "#password"
    with: $pass
  - click: "#login-btn"
  - assert: ".welcome"
    text: $expect
```

Each row is a separate report entry (`Data-driven login [user1]`). Optional `name` / `label` on a row sets the suffix; otherwise `[case N]`.  
`data:` + `for:` remain for nested / computed loops.

### POM with `do:`

Import a page object, then call its `actions:` by name:

```yaml
imports:
  - pages/login.yaml

steps:
  - goto: $base_url
  - do: login.login
    user: $test_user
    pass: $test_pass
```

`do: page.action` resolves against imported pages (`LoginPage` в†’ page id `login`).  
`do: login` works when the action name is unique across imports.  
Sibling keys (and optional `vars:`) merge into the action scope for that call.  
Use `include: login/login` with `vars:` when you need the older path-style call or to pull in a whole YAML file.

### Locators (strategy on page / config)

Steps always use `$email` (or an inline selector). **Strategy lives on config / page / element**, not on every step.

```yaml
# natl.config.yaml (or page root)
locator_strategy: css   # default for string elements & inline selectors

# pages/login.yaml
elements:
  email: "#email"                 # в†’ css
  legacy_title:                   # escape hatch
    strategy: xpath
    value: "//h1"
```

Web strategies today: **`css`**, **`xpath`**. The string is opaque to core вЂ” adapters validate. Playwright supports `css` and `xpath`; unknown strategy в†’ clear error.

Priority for an element: object `strategy` в†’ page `locator_strategy` в†’ project `locator_strategy` в†’ `css`.

### Multi-engine blocks (`with:`)

Mix UI and HTTP in one scenario without putting `engine:` on every step:

```yaml
engine: playwright

steps:
  - do: login.login
    user: $user
    pass: $pass
  - with: http
    steps:
      - get: $api_base/orders/$id
        save: order
      - assert: $order.status == 200
  - click: $refresh
```

Default engine = scenario root / `natl.config`. Inside `with:` the nested steps run under that engine. FAIL lines include `[http]` / `[playwright]` so you can see which context failed. Per-step `engine:` remains an escape hatch.

### HTTP engine (`engine: http` / `with: http`)

Thin HTTP vocabulary (preferred over legacy `api:`):

```yaml
engine: http
steps:
  - get: https://example.com/health
    save: ping
  - post: https://example.com/login
    body: { user: $user }
    save: resp
  - assert: $resp.status == 200
```

Verbs: `get` / `post` / `put` / `patch` / `delete` (+ `headers`, `body`, `save`, `timeout`).  
Saved value is `{ status, headers, body, ok }`. Relative URLs resolve against `vars.base_url` when it is an `http(s)` URL.  
`api:` still works (compat) but new features go to `http` / these verbs вЂ” not a growing `api:` dialect.

## Compact step syntax (primary)

**Primary** (what you write and what JSON Schema validates) is compact steps as **valid YAML** вЂ” sibling keys or a single string value:

```yaml
- fill: "#email"
  with: $user
- wait: ".dashboard visible"
- assert: ".welcome"
  text: "Hello"
- assert: ".welcome"
  contains: "Hell"
- assert: ".price"
  text: "$10"
  soft: true
# alias вЂ” prefer soft: true on assert
- soft_assert: ".stock"
  visible: true
```

**Advanced:** nested objects (`fill: { locator: "#email", with: $user }`, `wait: { selector, state }`, вЂ¦) вЂ” still valid, for tooling / expansion.

**Runtime sugar:** same-line secondary keys that are *not* valid YAML still run via the preprocessor:

```yaml
- fill: "#email" with: $user
- wait: ".dashboard" visible
- assert: ".welcome" text: "Hello"
```

IDE / `yaml.schemas` will flag those one-liners as YAML errors; prefer the primary sibling/string form in checked-in scenarios.

Soft asserts do not stop the scenario. All soft failures are logged; after the last step the run fails with a summary (exit в‰  0). Hard `assert` remains fail-fast. Optional screenshots per soft fail: CLI `--soft-assert-screenshot` or `soft_assert_screenshot: true` in `natl.config.yaml`.

## IDE schemas

JSON Schema files live in `@natl/core` (`schemas/natl.config.schema.json`, `schemas/natl.test.schema.json`). The test schema covers **compact primary**. Wire them via the YAML extension `yaml.schemas` setting вЂ” see the [@natl/cli](../../cli/README.md) README section **IDE autocomplete**.

## Expressions

| Need | Syntax |
|------|--------|
| var | `$user` |
| nested | `$test.user` |
| env | `$env.TEST_USER` |
| secret | `$secret.TEST_PASS` (same source as env for `.env`; values are masked in logs) |

Compat: `${ENV:KEY}` still resolves (prefer `$env.KEY`).

Operators: `== != > < >= <= contains matches and or`.  
Builtins: `now today random_* len contains trim upper lower replace match join map filter range`.
