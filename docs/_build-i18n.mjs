import { writeFileSync } from "node:fs";

function pack(htmlLang, meta, nav, ui, footer, home, pages) {
  return { meta: { htmlLang, ...meta }, nav, ui, footer, home, pages };
}

const enHome = `
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Getting started</h3><p>Install the CLI, scaffold a project, get a green run.</p></a>
  <a class="card" href="syntax.html"><h3>Syntax</h3><p>Compact YAML steps, POM, cases, and HTTP blocks.</p></a>
  <a class="card" href="adapters.html"><h3>Adapters</h3><p>Playwright, Selenium, Cypress, and built-in HTTP.</p></a>
  <a class="card" href="canon.html"><h3>Canon</h3><p>Principles and the ~90% vocabulary that stays portable.</p></a>
</div>
<h2>Install</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<h2>Links</h2>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub repository</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">Examples</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/blob/main/CONTRIBUTING.md">Contributing</a></li>
</ul>`;

const enGs = `
<h1>Getting started</h1>
<h2>Requirements</h2>
<ul>
  <li>Node.js <strong>18+</strong></li>
  <li>npm (or a compatible client)</li>
  <li>For UI tests: a browser for your adapter (Chromium via Playwright by default)</li>
</ul>
<h2>Install</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<h2>Scaffold a project</h2>
<pre><code>mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>
<p><code>natl init</code> creates <code>natl.config.yaml</code>, <code>tests/example.yaml</code>, <code>.env.example</code>, <code>.gitignore</code>, and a short README.</p>
<h2>Try examples</h2>
<pre><code>git clone https://github.com/arslan-ahmetjanov/natl.git
cd natl/examples
natl run login.yaml</code></pre>
<p>HTTP demos need the local stub:</p>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml
natl run ui_http_block.yaml</code></pre>
<h2>Useful commands</h2>
<pre><code>natl run tests/
natl run tests/ --tags smoke
natl run tests/ --retries 2
natl validate tests/
natl engines</code></pre>`;

const enAdapters = `
<h1>Adapters</h1>
<p>NATL scenarios stay in YAML. UI engines plug in via <code>EngineAdapter</code>.</p>
<table>
<thead><tr><th>engine</th><th>Package</th><th>Notes</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Default. Chromium / Firefox / WebKit</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>Chrome / Firefox / Edge</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>MVP command-bridge</td></tr>
<tr><td><code>http</code></td><td>built into <code>@natl/core</code></td><td>API only</td></tr>
</tbody>
</table>
<pre><code>engine: playwright
browser: chromium
headless: true</code></pre>
<pre><code>natl run suite.yaml --engine selenium</code></pre>
<h2>UI + HTTP</h2>
<pre><code>engine: playwright
steps:
  - goto: $base_url
  - with: http
    steps:
      - get: $api_base/get
        save: ping
      - assert: $ping.status == 200</code></pre>`;

const enArch = `
<h1>Architecture</h1>
<p>NATL separates <strong>what to test</strong> (compact YAML + POM) from <strong>how to drive the browser</strong> (<code>EngineAdapter</code> v2).</p>
<ul>
<li><strong>core</strong> — language, expressions, HTTP helpers, reporters</li>
<li><strong>adapters</strong> — Playwright / Selenium / Cypress packages</li>
<li><strong>cli</strong> — loads adapters at runtime via <code>engine:</code></li>
</ul>
<pre><code>core/
adapter-playwright/
adapter-selenium/
adapter-cypress/
cli/
examples/
docs/</code></pre>`;

const enCanon = `
<h1>Language canon</h1>
<p>Short fullstack YAML for web UI and API in one scenario file.</p>
<table>
<thead><tr><th>Principle</th><th>Consequence</th></tr></thead>
<tbody>
<tr><td>Maximally short</td><td>Compact steps; POM via <code>do:</code></td></tr>
<tr><td>Fullstack</td><td>UI + HTTP in one steps list</td></tr>
<tr><td>One scenario, many contexts</td><td>config / <code>--env</code> / vars / cases</td></tr>
<tr><td>Portable via adapter</td><td>Typical flows survive <code>engine:</code> changes</td></tr>
<tr><td>Honest ceiling</td><td>Most smoke ports; engine-specific tails are escape hatches</td></tr>
<tr><td>Runner ≠ TMS</td><td>No dashboard in the CLI</td></tr>
</tbody>
</table>
<h2>~90% UI verbs</h2>
<p><code>goto</code>, <code>click</code>/<code>tap</code>, <code>fill</code>, <code>assert</code>, <code>wait</code>, gestures, plus <code>do</code> / <code>cases</code>.</p>`;

const enSyntax = `
<h1>Syntax</h1>
<p>Prefer <strong>compact</strong> steps.</p>
<pre><code>steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Hello"</code></pre>
<h2>POM</h2>
<pre><code>imports:
  - pages/login.yaml
steps:
  - do: login.login
    user: $user
    pass: $pass</code></pre>
<h2>Cases</h2>
<pre><code>cases:
  - { name: a, user: a@test.com, expect: "Welcome A" }
steps:
  - fill: "#email"
    with: $user
  - assert: ".welcome"
    text: $expect</code></pre>
<h2>HTTP</h2>
<pre><code>engine: http
steps:
  - get: $api_base/get
    save: ping
  - assert: $ping.status == 200</code></pre>`;

const locales = {
  en: pack(
    "en",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Home",
      gettingStarted: "Getting started",
      syntax: "Syntax",
      canon: "Canon",
      architecture: "Architecture",
      adapters: "Adapters",
    },
    { language: "Language", theme: "Theme", themeLight: "Light", themeDark: "Dark" },
    { line: "NATL is open source under the MIT License." },
    {
      headline: "Short YAML tests for web UI and API",
      lede: "Open-source runner: write compact scenarios once, run locally or in CI, swap browser engines through adapters.",
    },
    {
      home: { title: "Home", html: enHome },
      "getting-started": { title: "Getting started", html: enGs },
      adapters: { title: "Adapters", html: enAdapters },
      architecture: { title: "Architecture", html: enArch },
      canon: { title: "Canon", html: enCanon },
      syntax: { title: "Syntax", html: enSyntax },
    },
  ),
  ru: pack(
    "ru",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Главная",
      gettingStarted: "Быстрый старт",
      syntax: "Синтаксис",
      canon: "Канон",
      architecture: "Архитектура",
      adapters: "Адаптеры",
    },
    { language: "Язык", theme: "Тема", themeLight: "Светлая", themeDark: "Тёмная" },
    { line: "NATL — открытый проект под лицензией MIT." },
    {
      headline: "Короткие YAML-тесты для web UI и API",
      lede: "Open-source раннер: пишете компактный сценарий один раз, гоняете локально или в CI, меняете браузерный движок через adapter.",
    },
    {
      home: {
        title: "Главная",
        html: enHome
          .replaceAll("Getting started", "Быстрый старт")
          .replaceAll("Install the CLI, scaffold a project, get a green run.", "Установка CLI, каркас проекта, первый зелёный прогон.")
          .replaceAll(">Syntax<", ">Синтаксис<")
          .replaceAll("Compact YAML steps, POM, cases, and HTTP blocks.", "Compact YAML, POM, cases и HTTP-блоки.")
          .replaceAll(">Adapters<", ">Адаптеры<")
          .replaceAll("Playwright, Selenium, Cypress, and built-in HTTP.", "Playwright, Selenium, Cypress и встроенный HTTP.")
          .replaceAll(">Canon<", ">Канон<")
          .replaceAll("Principles and the ~90% vocabulary that stays portable.", "Принципы и словарь ~90%, который остаётся переносимым.")
          .replaceAll(">Install<", ">Установка<")
          .replaceAll(">Links<", ">Ссылки<")
          .replaceAll("GitHub repository", "Репозиторий на GitHub")
          .replaceAll(">Examples<", ">Примеры<"),
      },
      "getting-started": {
        title: "Быстрый старт",
        html: `
<h1>Быстрый старт</h1>
<h2>Требования</h2>
<ul>
<li>Node.js <strong>18+</strong></li>
<li>npm</li>
<li>Для UI — браузер adapter (по умолчанию Chromium / Playwright)</li>
</ul>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>
<p>HTTP-примеры: сначала <code>node stubs/echo-server.mjs</code>.</p>`,
      },
      adapters: {
        title: "Адаптеры",
        html: enAdapters
          .replace("<h1>Adapters</h1>", "<h1>Адаптеры</h1>")
          .replace("NATL scenarios stay in YAML. UI engines plug in via", "Сценарии остаются в YAML. UI-движки подключаются через")
          .replace("<th>Package</th><th>Notes</th>", "<th>Пакет</th><th>Заметки</th>")
          .replace("Default. Chromium / Firefox / WebKit", "По умолчанию")
          .replace("API only", "Только API"),
      },
      architecture: {
        title: "Архитектура",
        html: `
<h1>Архитектура</h1>
<p>NATL отделяет <strong>что тестировать</strong> (YAML + POM) от <strong>как управлять браузером</strong> (<code>EngineAdapter</code> v2).</p>
<ul>
<li><strong>core</strong> — язык, выражения, HTTP, reporters</li>
<li><strong>adapters</strong> — Playwright / Selenium / Cypress</li>
<li><strong>cli</strong> — загрузка adapter по <code>engine:</code></li>
</ul>`,
      },
      canon: {
        title: "Канон",
        html: `
<h1>Канон языка</h1>
<p>Короткий fullstack YAML для web UI и API в одном файле.</p>
<ul>
<li>Максимально короткий язык</li>
<li>Один steps — много контекстов</li>
<li>Портируемость через adapter</li>
<li>Честный потолок</li>
<li>Раннер, не TMS</li>
</ul>`,
      },
      syntax: {
        title: "Синтаксис",
        html: enSyntax.replace("<h1>Syntax</h1>", "<h1>Синтаксис</h1>").replace(
          "Prefer <strong>compact</strong> steps.",
          "Предпочитайте <strong>compact</strong>-форму шагов.",
        ),
      },
    },
  ),
  zh: pack(
    "zh-CN",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "首页",
      gettingStarted: "快速开始",
      syntax: "语法",
      canon: "规范",
      architecture: "架构",
      adapters: "适配器",
    },
    { language: "语言", theme: "主题", themeLight: "浅色", themeDark: "深色" },
    { line: "NATL 是 MIT 许可的开源项目。" },
    {
      headline: "面向 Web UI 与 API 的短 YAML 测试",
      lede: "开源运行器：一次编写紧凑场景，本地或 CI 执行，通过适配器切换浏览器引擎。",
    },
    {
      home: {
        title: "首页",
        html: `
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>快速开始</h3><p>安装 CLI，初始化项目，跑通第一次测试。</p></a>
  <a class="card" href="syntax.html"><h3>语法</h3><p>紧凑 YAML、POM、cases 与 HTTP 块。</p></a>
  <a class="card" href="adapters.html"><h3>适配器</h3><p>Playwright、Selenium、Cypress 与内置 HTTP。</p></a>
  <a class="card" href="canon.html"><h3>规范</h3><p>原则与约 90% 可移植词汇。</p></a>
</div>
<h2>安装</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>`,
      },
      "getting-started": {
        title: "快速开始",
        html: `
<h1>快速开始</h1>
<ul><li>Node.js <strong>18+</strong></li><li>npm</li><li>UI 需要浏览器（默认 Playwright Chromium）</li></ul>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>`,
      },
      adapters: {
        title: "适配器",
        html: `
<h1>适配器</h1>
<p>场景保持 YAML；UI 引擎通过 <code>EngineAdapter</code> 接入。</p>
<table>
<thead><tr><th>engine</th><th>包</th><th>说明</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>默认</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>MVP</td></tr>
<tr><td><code>http</code></td><td><code>@natl/core</code></td><td>仅 API</td></tr>
</tbody></table>`,
      },
      architecture: {
        title: "架构",
        html: `
<h1>架构</h1>
<p>NATL 将<strong>测什么</strong>（YAML + POM）与<strong>如何驱动浏览器</strong>（EngineAdapter v2）分离。</p>
<ul><li><strong>core</strong></li><li><strong>adapters</strong></li><li><strong>cli</strong></li></ul>`,
      },
      canon: {
        title: "规范",
        html: `
<h1>语言规范</h1>
<ul><li>尽量简短</li><li>同一 steps，多种上下文</li><li>通过适配器保持可移植</li><li>诚实的能力边界</li><li>运行器，不是 TMS</li></ul>`,
      },
      syntax: {
        title: "语法",
        html: enSyntax.replace("<h1>Syntax</h1>", "<h1>语法</h1>").replace(
          "Prefer <strong>compact</strong> steps.",
          "优先使用<strong>紧凑</strong>步骤写法。",
        ),
      },
    },
  ),
  es: pack(
    "es",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Inicio",
      gettingStarted: "Primeros pasos",
      syntax: "Sintaxis",
      canon: "Canon",
      architecture: "Arquitectura",
      adapters: "Adaptadores",
    },
    { language: "Idioma", theme: "Tema", themeLight: "Claro", themeDark: "Oscuro" },
    { line: "NATL es open source bajo licencia MIT." },
    {
      headline: "Pruebas YAML cortas para UI web y API",
      lede: "Runner open source: escribe escenarios compactos una vez, ejecútalos localmente o en CI y cambia el motor del navegador con adaptadores.",
    },
    {
      home: {
        title: "Inicio",
        html: `
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Primeros pasos</h3><p>Instala el CLI, crea un proyecto y consigue un PASS.</p></a>
  <a class="card" href="syntax.html"><h3>Sintaxis</h3><p>YAML compacto, POM, cases y bloques HTTP.</p></a>
  <a class="card" href="adapters.html"><h3>Adaptadores</h3><p>Playwright, Selenium, Cypress y HTTP integrado.</p></a>
  <a class="card" href="canon.html"><h3>Canon</h3><p>Principios y vocabulario portable (~90%).</p></a>
</div>
<h2>Instalación</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>`,
      },
      "getting-started": {
        title: "Primeros pasos",
        html: `
<h1>Primeros pasos</h1>
<ul><li>Node.js <strong>18+</strong></li><li>npm</li><li>Para UI: navegador del adaptador (Chromium/Playwright)</li></ul>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>`,
      },
      adapters: {
        title: "Adaptadores",
        html: `
<h1>Adaptadores</h1>
<p>Los escenarios permanecen en YAML. Los motores UI usan <code>EngineAdapter</code>.</p>
<table>
<thead><tr><th>engine</th><th>Paquete</th><th>Notas</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Por defecto</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>MVP</td></tr>
<tr><td><code>http</code></td><td><code>@natl/core</code></td><td>Solo API</td></tr>
</tbody></table>`,
      },
      architecture: {
        title: "Arquitectura",
        html: `
<h1>Arquitectura</h1>
<p>NATL separa <strong>qué probar</strong> de <strong>cómo controlar el navegador</strong>.</p>
<ul><li><strong>core</strong></li><li><strong>adapters</strong></li><li><strong>cli</strong></li></ul>`,
      },
      canon: {
        title: "Canon",
        html: `
<h1>Canon del lenguaje</h1>
<ul><li>Lenguaje corto</li><li>Un steps, muchos contextos</li><li>Portabilidad vía adaptador</li><li>Techo honesto</li><li>Runner, no TMS</li></ul>`,
      },
      syntax: {
        title: "Sintaxis",
        html: enSyntax.replace("<h1>Syntax</h1>", "<h1>Sintaxis</h1>").replace(
          "Prefer <strong>compact</strong> steps.",
          "Prefiere pasos en forma <strong>compact</strong>.",
        ),
      },
    },
  ),
};

for (const [name, data] of Object.entries(locales)) {
  writeFileSync(`docs/i18n/${name}.json`, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", name);
}
