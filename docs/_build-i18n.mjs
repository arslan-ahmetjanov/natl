import { readFileSync, writeFileSync } from "node:fs";

function pack(htmlLang, meta, nav, ui, footer, home, pages) {
  return { meta: { htmlLang, ...meta }, nav, ui, footer, home, pages };
}

function load(name) {
  return readFileSync(new URL(`./content/${name}`, import.meta.url), "utf8").trim();
}

const enHome = `
<p>NATL is a short open-source YAML runner for <strong>web UI and API</strong> tests. Write one compact scenario, run it locally or in CI, and keep it when the browser stack changes — swap <code>engine:</code> instead of rewriting the suite.</p>
<p>New here? Open the <a href="getting-started.html">guide</a> and start at Install.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Guide</h3><p>Install, first PASS, then the language block by block.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Troubleshooting</h3><p>Common failures and how to fix them.</p></a>
  <a class="card" href="adapters.html"><h3>Adapters</h3><p>Playwright by default; Selenium and Cypress when you need them.</p></a>
  <a class="card" href="canon.html"><h3>Canon</h3><p>Design choices that stay fixed.</p></a>
</div>
<h2>Install</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>
<div class="author-block">
  <p><strong>Arslan Ahmetjanov</strong></p>
  <p class="muted"><a href="https://telegram.me/arslan_ahmetjanov">Telegram</a></p>
</div>`;

const ruHome = `
<p>NATL — короткий open-source YAML-раннер для тестов <strong>web UI и API</strong>. Один компактный сценарий, локально или в CI. Сменился браузерный стек — меняете <code>engine:</code>, а не весь сьют.</p>
<p>С нуля? Откройте <a href="getting-started.html">гайд</a> и начните с установки.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Гайд</h3><p>Установка, первый PASS, затем язык по блокам.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Сбои</h3><p>Типичные ошибки и что с ними делать.</p></a>
  <a class="card" href="adapters.html"><h3>Адаптеры</h3><p>Playwright по умолчанию; Selenium и Cypress при необходимости.</p></a>
  <a class="card" href="canon.html"><h3>Канон</h3><p>Зафиксированные решения по дизайну.</p></a>
</div>
<h2>Установка</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>
<div class="author-block">
  <p><strong>Арслан Ахметжанов</strong></p>
  <p class="muted"><a href="https://telegram.me/arslan_ahmetjanov">Telegram</a></p>
</div>`;

const zhHome = `
<p>NATL 是面向 <strong>Web UI 与 API</strong> 测试的短 YAML 开源运行器。写一份紧凑场景，本地或 CI 运行；浏览器栈变了，改 <code>engine:</code> 即可，不必整套重写。</p>
<p>第一次用？打开<a href="getting-started.html">指南</a>，从安装开始。</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>指南</h3><p>安装、首次 PASS，再按块看语言。</p></a>
  <a class="card" href="troubleshooting.html"><h3>排错</h3><p>常见失败与处理办法。</p></a>
  <a class="card" href="adapters.html"><h3>适配器</h3><p>默认 Playwright；需要时用 Selenium / Cypress。</p></a>
  <a class="card" href="canon.html"><h3>规范</h3><p>固定下来的设计取舍。</p></a>
</div>
<h2>安装</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>
<div class="author-block">
  <p><strong>Arslan Ahmetjanov</strong></p>
  <p class="muted"><a href="https://telegram.me/arslan_ahmetjanov">Telegram</a></p>
</div>`;

const esHome = `
<p>NATL es un runner YAML corto de código abierto para pruebas de <strong>UI web y API</strong>. Escribes un escenario compacto, lo corres local o en CI, y lo conservas cuando cambia el stack del navegador: cambias <code>engine:</code>, no toda la suite.</p>
<p>¿Empiezas ahora? Abre la <a href="getting-started.html">guía</a> y empieza por Instalar.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Guía</h3><p>Instalación, primer PASS y el lenguaje por bloques.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Problemas</h3><p>Fallos habituales y cómo resolverlos.</p></a>
  <a class="card" href="adapters.html"><h3>Adaptadores</h3><p>Playwright por defecto; Selenium y Cypress si hace falta.</p></a>
  <a class="card" href="canon.html"><h3>Canon</h3><p>Decisiones de diseño que se mantienen.</p></a>
</div>
<h2>Instalar</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>
<div class="author-block">
  <p><strong>Arslan Ahmetjanov</strong></p>
  <p class="muted"><a href="https://telegram.me/arslan_ahmetjanov">Telegram</a></p>
</div>`;

const enTrouble = `
<h1>Troubleshooting</h1>
<p>Common failures and what to check first.</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>Browser / Chromium errors</h2>
<pre><code>npx playwright install chromium
npx playwright install --with-deps chromium</code></pre>
<h2><code>FAIL … assert</code> / element not found</h2>
<ul>
  <li>Is the selector still right?</li>
  <li>Prefer stable <code>#id</code></li>
  <li>Check <code>artifacts/</code></li>
</ul>
<h2>YAML indentation</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP examples hang</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<h2>Wrong engine</h2>
<pre><code>natl engines
npm install -g @natl/adapter-playwright</code></pre>
<p>Still stuck? <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub issues</a>.</p>`;

const ruTrouble = `
<h1>Сбои</h1>
<p>Типичные сбои и что проверить в первую очередь.</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>Браузер / Chromium</h2>
<pre><code>npx playwright install chromium</code></pre>
<h2>FAIL / элемент не найден</h2>
<ul>
  <li>Селектор ещё верный?</li>
  <li>Стабильный <code>#id</code></li>
  <li>Скрин в <code>artifacts/</code></li>
</ul>
<h2>Отступы YAML</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP зависает</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<p><a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub issues</a>.</p>`;

const zhTrouble = `
<h1>排错</h1>
<p>常见失败与优先排查项。</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>浏览器 / Chromium</h2>
<pre><code>npx playwright install chromium</code></pre>
<h2>FAIL / 找不到元素</h2>
<ul>
  <li>选择器还对吗？</li>
  <li>优先 <code>#id</code></li>
  <li>看 <code>artifacts/</code></li>
</ul>
<h2>YAML 缩进</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<p><a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub issues</a>。</p>`;

const esTrouble = `
<h1>Problemas frecuentes</h1>
<p>Fallos habituales y qué revisar primero.</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>Navegador / Chromium</h2>
<pre><code>npx playwright install chromium</code></pre>
<h2>FAIL / elemento no encontrado</h2>
<ul>
  <li>¿Sigue bien el selector?</li>
  <li>Prefiere <code>#id</code></li>
  <li>Revisa <code>artifacts/</code></li>
</ul>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<p><a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub issues</a>.</p>`;

const enAdapters = `
<h1>Adapters</h1>
<p>The YAML is the contract. Adapters drive a browser — or skip it for HTTP.</p>
<table>
<thead><tr><th>engine</th><th>Package</th><th>When</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Default</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Cypress teams (MVP)</td></tr>
<tr><td><code>http</code></td><td>built into <code>@natl/core</code></td><td>API-only</td></tr>
</tbody>
</table>
<pre><code>natl run suite.yaml --engine selenium</code></pre>
<p>UI + HTTP → <code>with: http</code> in the <a href="getting-started.html#http">guide</a>.</p>`;

const ruAdapters = `
<h1>Адаптеры</h1>
<p>YAML — контракт. Adapter водит браузер или обходится HTTP.</p>
<table>
<thead><tr><th>engine</th><th>Пакет</th><th>Когда</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>По умолчанию</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Команды на Cypress (MVP)</td></tr>
<tr><td><code>http</code></td><td>встроен в <code>@natl/core</code></td><td>Только API</td></tr>
</tbody>
</table>
<p>UI + HTTP → <code>with: http</code> в <a href="getting-started.html#http">гайде</a>.</p>`;

const zhAdapters = `
<h1>适配器</h1>
<p>YAML 是契约。适配器驱动浏览器，或对 HTTP 跳过浏览器。</p>
<table>
<thead><tr><th>engine</th><th>包</th><th>何时</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>默认</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Cypress 团队（MVP）</td></tr>
<tr><td><code>http</code></td><td>内置于 <code>@natl/core</code></td><td>仅 API</td></tr>
</tbody>
</table>
<p>UI + HTTP → 见<a href="getting-started.html#http">指南</a>中的 <code>with: http</code>。</p>`;

const esAdapters = `
<h1>Adaptadores</h1>
<p>El YAML es el contrato. El adaptador conduce el navegador — o lo omite para HTTP.</p>
<table>
<thead><tr><th>engine</th><th>Paquete</th><th>Cuándo</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Por defecto</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Equipos Cypress (MVP)</td></tr>
<tr><td><code>http</code></td><td>integrado en <code>@natl/core</code></td><td>Solo API</td></tr>
</tbody>
</table>
<p>UI + HTTP → <code>with: http</code> en la <a href="getting-started.html#http">guía</a>.</p>`;

const enArch = `
<h1>Architecture</h1>
<ul>
  <li><strong>You write YAML</strong></li>
  <li><strong>@natl/cli</strong> — files, config, filters</li>
  <li><strong>@natl/core</strong> — parse, interpolate, interpret</li>
  <li><strong>Adapter</strong> — Playwright / Selenium / Cypress — or built-in <code>http</code></li>
</ul>
<p>Typical flows stay portable when you change <code>engine:</code>. Details live in the <a href="canon.html">canon</a>.</p>`;

const ruArch = `
<h1>Архитектура</h1>
<ul>
  <li><strong>Вы пишете YAML</strong></li>
  <li><strong>@natl/cli</strong> — файлы, конфиг, фильтры</li>
  <li><strong>@natl/core</strong> — парсер, интерполяция, интерпретатор</li>
  <li><strong>Adapter</strong> — Playwright / Selenium / Cypress — или <code>http</code></li>
</ul>
<p>Типичные потоки портативны при смене <code>engine:</code>. Детали — в <a href="canon.html">каноне</a>.</p>`;

const zhArch = `
<h1>架构</h1>
<ul>
  <li><strong>你写 YAML</strong></li>
  <li><strong>@natl/cli</strong> — 文件、配置、过滤</li>
  <li><strong>@natl/core</strong> — 解析、插值、解释执行</li>
  <li><strong>适配器</strong> — Playwright / Selenium / Cypress — 或内置 <code>http</code></li>
</ul>
<p>换 <code>engine:</code> 时典型流程仍可移植。详见<a href="canon.html">规范</a>。</p>`;

const esArch = `
<h1>Arquitectura</h1>
<ul>
  <li><strong>Escribes YAML</strong></li>
  <li><strong>@natl/cli</strong> — archivos, config, filtros</li>
  <li><strong>@natl/core</strong> — parseo, interpolación, intérprete</li>
  <li><strong>Adaptador</strong> — Playwright / Selenium / Cypress — o <code>http</code></li>
</ul>
<p>Los flujos típicos siguen siendo portables al cambiar <code>engine:</code>. Detalles en el <a href="canon.html">canon</a>.</p>`;

const enCanon = `
<h1>Canon</h1>
<table>
<thead><tr><th>I believe</th><th>So</th></tr></thead>
<tbody>
<tr><td>Short language</td><td>A smoke fits on one screen</td></tr>
<tr><td>UI + API together</td><td><code>with: http</code> in the same file</td></tr>
<tr><td>Context outside steps</td><td>config / <code>--env</code> / <code>cases:</code></td></tr>
<tr><td>Portable via adapters</td><td>Same YAML; browsers = adapter capability</td></tr>
<tr><td>Honest ceiling</td><td>~90% of smokes; escape hatches for the rest</td></tr>
<tr><td>Runner ≠ TMS</td><td>CLI runs tests — no dashboard product</td></tr>
</tbody>
</table>`;

const ruCanon = `
<h1>Канон</h1>
<table>
<thead><tr><th>Верю</th><th>Значит</th></tr></thead>
<tbody>
<tr><td>Короткий язык</td><td>Smoke на один экран</td></tr>
<tr><td>UI + API вместе</td><td><code>with: http</code> в одном файле</td></tr>
<tr><td>Контекст вне шагов</td><td>config / <code>--env</code> / <code>cases:</code></td></tr>
<tr><td>Портативность через адаптеры</td><td>Тот же YAML; браузеры = capability адаптера</td></tr>
<tr><td>Честный потолок</td><td>~90% smokes; остальное — escape hatch</td></tr>
<tr><td>Раннер ≠ TMS</td><td>CLI гоняет тесты — без дашборд-продукта</td></tr>
</tbody>
</table>`;

const zhCanon = `
<h1>规范</h1>
<table>
<thead><tr><th>我相信</th><th>因此</th></tr></thead>
<tbody>
<tr><td>短语言</td><td>一个 smoke 放进一屏</td></tr>
<tr><td>UI + API 一起</td><td>同一文件里 <code>with: http</code></td></tr>
<tr><td>上下文在步骤外</td><td>config / <code>--env</code> / <code>cases:</code></td></tr>
<tr><td>靠适配器可移植</td><td>同一份 YAML；浏览器 = 适配器能力</td></tr>
<tr><td>诚实的能力边界</td><td>~90% smoke；其余用逃生舱</td></tr>
<tr><td>运行器 ≠ TMS</td><td>CLI 跑测试 — 不是仪表盘产品</td></tr>
</tbody>
</table>`;

const esCanon = `
<h1>Canon</h1>
<table>
<thead><tr><th>Creo</th><th>Así que</th></tr></thead>
<tbody>
<tr><td>Lenguaje corto</td><td>Un smoke cabe en una pantalla</td></tr>
<tr><td>UI + API juntos</td><td><code>with: http</code> en el mismo archivo</td></tr>
<tr><td>Contexto fuera de los pasos</td><td>config / <code>--env</code> / <code>cases:</code></td></tr>
<tr><td>Portable con adaptadores</td><td>Mismo YAML; navegadores = capacidad del adaptador</td></tr>
<tr><td>Techo honesto</td><td>~90% de smokes; el resto, escape hatch</td></tr>
<tr><td>Runner ≠ TMS</td><td>El CLI ejecuta tests — no un dashboard</td></tr>
</tbody>
</table>`;

const locales = {
  en: pack(
    "en",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Home",
      guide: "Guide",
      troubleshooting: "Troubleshooting",
      canon: "Canon",
      architecture: "Architecture",
      adapters: "Adapters",
    },
    { language: "Language", theme: "Theme", themeLight: "Light", themeDark: "Dark" },
    { line: "MIT License." },
    {
      headline: "This is NATL.",
      lede: "A short YAML runner for web UI and API. Write the test once; keep it when the stack moves.",
    },
    {
      home: { title: "Home", html: enHome },
      guide: { title: "Guide", html: load("en-guide.html") },
      troubleshooting: { title: "Troubleshooting", html: enTrouble },
      adapters: { title: "Adapters", html: enAdapters },
      architecture: { title: "Architecture", html: enArch },
      canon: { title: "Canon", html: enCanon },
    },
  ),
  ru: pack(
    "ru",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Главная",
      guide: "Гайд",
      troubleshooting: "Сбои",
      canon: "Канон",
      architecture: "Архитектура",
      adapters: "Адаптеры",
    },
    { language: "Язык", theme: "Тема", themeLight: "Светлая", themeDark: "Тёмная" },
    { line: "Лицензия MIT." },
    {
      headline: "Это NATL.",
      lede: "Короткий YAML-раннер для web UI и API. Пишете тест один раз — и не выкидываете его при смене стека.",
    },
    {
      home: { title: "Главная", html: ruHome },
      guide: { title: "Гайд", html: load("ru-guide.html") },
      troubleshooting: { title: "Сбои", html: ruTrouble },
      adapters: { title: "Адаптеры", html: ruAdapters },
      architecture: { title: "Архитектура", html: ruArch },
      canon: { title: "Канон", html: ruCanon },
    },
  ),
  zh: pack(
    "zh-CN",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "首页",
      guide: "指南",
      troubleshooting: "排错",
      canon: "规范",
      architecture: "架构",
      adapters: "适配器",
    },
    { language: "语言", theme: "主题", themeLight: "浅色", themeDark: "深色" },
    { line: "MIT 许可。" },
    {
      headline: "这就是 NATL。",
      lede: "短 YAML 运行器，面向 Web UI 与 API。写一次；栈变了也不必整套重来。",
    },
    {
      home: { title: "首页", html: zhHome },
      guide: { title: "指南", html: load("zh-guide.html") },
      troubleshooting: { title: "排错", html: zhTrouble },
      adapters: { title: "适配器", html: zhAdapters },
      architecture: { title: "架构", html: zhArch },
      canon: { title: "规范", html: zhCanon },
    },
  ),
  es: pack(
    "es",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Inicio",
      guide: "Guía",
      troubleshooting: "Problemas",
      canon: "Canon",
      architecture: "Arquitectura",
      adapters: "Adaptadores",
    },
    { language: "Idioma", theme: "Tema", themeLight: "Claro", themeDark: "Oscuro" },
    { line: "Licencia MIT." },
    {
      headline: "Esto es NATL.",
      lede: "Un runner YAML corto para UI web y API. Escribes el test una vez y lo conservas cuando cambia el stack.",
    },
    {
      home: { title: "Inicio", html: esHome },
      guide: { title: "Guía", html: load("es-guide.html") },
      troubleshooting: { title: "Problemas", html: esTrouble },
      adapters: { title: "Adaptadores", html: esAdapters },
      architecture: { title: "Arquitectura", html: esArch },
      canon: { title: "Canon", html: esCanon },
    },
  ),
};

for (const [name, data] of Object.entries(locales)) {
  writeFileSync(`docs/i18n/${name}.json`, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", name, "guide", data.pages.guide.html.length);
}
