# 01 — Sandbox on GitHub Pages + init scenario

Status: `done`

## Цель

Песочница на текущем docs-сайте (GitHub Pages) и сценарий из `natl init`, который бьёт в неё — первый PASS без example.com.

## Что сделать

- [x] Страница `docs/sandbox.html` + `docs/sandbox-api.json` (стабильные селекторы)
- [x] Локальный twin `examples/fixtures/sandbox.html` (+ json рядом)
- [x] `cli/templates`: `base_url` → Pages sandbox; `tests/example.yaml` под login smoke
- [x] Nav + i18n ключ Sandbox; гайд: init → sandbox
- [x] Сборка cli; smoke init+run (local fixture PASS)

## Готово когда

1. https://arslan-ahmetjanov.github.io/natl/sandbox.html открывается, login + API ping работают. *(после push)*
2. `natl init` → `base_url` на sandbox; `natl run tests/` зелёный (сеть + chromium). *(шаблоны готовы; npm publish отдельно)*
3. Offline: twin в `examples/fixtures/sandbox.html` — smoke PASS локально.

## Не входит

- YAML-редактор в браузере / TMS
- Publish npm (отдельный запрос DevOps)
- Ломающие смены id (`#email`, `#password`, `#login-btn`, `.welcome`, `#ping-api`, `#api-status`)

## Решения по умолчанию

- URL: `…/natl/sandbox.html`
- UI на EN (стабильные assert-тексты); chrome сайта — i18n nav
- Init по умолчанию на Pages; в конфиге комментарий про local twin
