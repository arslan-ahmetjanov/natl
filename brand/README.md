# NATL brand

**Выбрано:** иконка YAML-steps + play, wordmark `natl`, lockup с tagline.

Источник правды — эта папка. Копии лежат в каждом репо: `core/brand`, `cli/brand`, `adapter-playwright/brand`, `examples/brand`.

## Канонические ассеты (для README)

| Файл | Назначение |
|------|------------|
| [`natl-icon.png`](./natl-icon.png) / [`natl-icon-steps.svg`](./natl-icon-steps.svg) | Иконка 512 / SVG |
| [`natl-icon-128.png`](./natl-icon-128.png) | Favicon / avatar |
| [`natl-lockup.png`](./natl-lockup.png) / [`natl-lockup.svg`](./natl-lockup.svg) | Шапка README |
| [`natl-wordmark.png`](./natl-wordmark.png) / [`natl-wordmark.svg`](./natl-wordmark.svg) | Wordmark + caret |
| [`natl-wordmark-dark.png`](./natl-wordmark-dark.png) | Wordmark на тёмном |
| [`badges/`](./badges/) | Статические npm / License / Docs бейджи для корневого README (без shields.io) |

Цвета: slate `#0F172A`, bars `#94A3B8`, accent teal `#14B8A6` / `#0D9488`.

## Синхронизация в пакеты / репо

```bash
node brand/rasterize.mjs          # SVG → PNG
node brand/sync-to-packages.mjs   # скопировать в core/cli/adapter/examples
```

В `package.json` пакетов `brand/` входит в `files`. На **npmjs.com** относительные `./brand/*.png` **не** рендерятся — в package README используй абсолютный CDN, например:

`https://cdn.jsdelivr.net/npm/@natl/<pkg>/brand/natl-lockup.png`

(В GitHub / локально относительный путь ок.)

## Hero-рендеры

`natl-*-*.hero.png` — опциональные AI-варианты; в пакеты не копируются.

Превью эскизов: [`preview.html`](./preview.html).
