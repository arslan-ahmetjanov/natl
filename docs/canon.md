# NATL language canon

**Audience:** QA, developers, DevOps.  
**Product:** a **short fullstack YAML** language for **web UI** (desktop + mobile web) and **API** in one scenario file.  
**Detail / how-to:** [syntax.md](syntax.md).

---

## North star

| Principle | Consequence |
|-----------|-------------|
| Maximally short language | Compact steps are primary; POM via `do:`; no ceremony |
| Fullstack web + API | One steps list; thin HTTP surface (`api:` today → `engine: http` / `with:` later) |
| One scenario, many contexts | Stand / viewport / locale / data via config, `--env`, `vars`, `cases` — **not** `if: mobile` in UI steps |
| Portability via adapter | Typical flows survive `engine:` change; browsers = **adapter capability**, not a fixed list in the language |
| Honest ceiling | Most smoke/regression is portable; engine-specific tails are escape hatches |
| Runner ≠ TMS | No dashboard / marketplace in CLI |

**Acceptance filter for a new verb:** does a short fullstack web+API scenario need it in the built-in ~90%? If no → leave for plugins / wave 6+ / out of scope.

---

## One steps YAML

```yaml
name: Checkout smoke
engine: playwright          # UI default today; more adapters later
vars:
  base_url: $env.BASE_URL
cases:
  - { user: a@test.com, expect: "Welcome" }
steps:
  - goto: $base_url
  - do: login.login
    user: $user
    pass: $secret.TEST_PASS
  - assert: ".welcome"
    text: $expect
  - api: POST /cart          # compat; growth → engine: http / with: http
    body: { sku: "X" }
```

Same steps for staging vs prod (`--env`), desktop vs mobile web (config / adapter options — wave 6), and data rows (`cases:`). Do **not** branch UI steps on device.

---

## ~90% vocabulary (UI)

| Verb | Role |
|------|------|
| `goto` | Navigate |
| `click` | Primary pointer action; `tap` is the same step |
| `fill` / `select` / `check` / `uncheck` | Forms |
| `wait` | Explicit only: `hidden`, `N ms`, non-default state (auto-wait covers “become visible”) |
| `assert` | Checks (`text` / `contains` / `visible` / `hidden` / `attr` / url / expr); soft via `soft: true` |
| `get_text` / `get_attr` | Rare: save into a var |
| `screenshot` / `log` / `set` / `debug` | Support |
| `scroll` / `swipe` / `long_press` | Mobile/desktop web gestures (same scenario; no device `if`) |

**Flow:** `if` / `for` / `repeat` / `parallel` / `do` / `include` / `cases`.

**Substitutions:** `$var`, `$obj.field`, `$env.KEY`, `$secret.KEY` (`${ENV:KEY}` compat).

**POM:** `imports` + `elements` / `actions`; call with `do: page.action` (prefer over path-style `include` for named actions).

**Schema:** compact sibling/string forms are primary.

---

## API

| Now | Direction |
|-----|-----------|
| Built-in `api:` steps | Compat / freeze trajectory |
| Growth | `engine: http` + blocks `with: http` |

Do not grow a parallel “fat” `api:` dialect. Keep HTTP thin and block-scoped next to UI steps.

---

## Engines and browsers

| | |
|--|--|
| Default UI engine | Playwright (`@natl/adapter-playwright`) |
| Contract | `EngineAdapter` v2 — auto-wait; `LocatorRef` `{ strategy, value }`; factory opts `browser` / `viewport` opaque to core |
| Extra adapters | Selenium (`@natl/adapter-selenium`), Cypress (`@natl/adapter-cypress`) — **same YAML**, different `engine:` |
| Browsers | Whatever the chosen adapter supports; docs say “depends on engine”, not a hard-coded matrix in core |

Multi-engine in one file: blocks `with:`.

---

## Out of the built-in ~90%

Not goals of the short language (or deferred):

- iframe, network route/mock, upload/download, tabs/popups (wave 6+)
- Visual / pixel asserts in core
- Native mobile apps
- Plugins / JS actions as the main extension story (escape hatch later)
- TMS UI, marketplace, Vault/AWS backends in-core

---

## Rules (checklist)

1. **Compact primary** — write what QA types; expanded objects are advanced.
2. **POM happy path** — `do: page.action`, not file-path rituals.
3. **No device branching in steps** — profile/env/viewport/vars/cases instead of `if: mobile`.
4. **Assert on locators** — avoid `get_text` → `save` → `assert` when `assert` + `text`/`contains` suffices.
5. **Soft is a modifier** — `assert` + `soft: true`; `soft_assert` is alias.
6. **Auto-wait** — actions/assert wait for the target; explicit `wait` for hidden/ms/special state.
7. **New verb?** — apply the acceptance filter above; otherwise keep it out of ~90%.

---

## Related

- [Syntax](syntax.md)
- [Architecture](architecture.md)
- [Getting started](getting-started.md)
