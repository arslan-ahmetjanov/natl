import { readFileSync, writeFileSync } from "node:fs";

function pack(htmlLang, meta, nav, ui, footer, home, pages) {
  return { meta: { htmlLang, ...meta }, nav, ui, footer, home, pages };
}

function load(name) {
  return readFileSync(new URL(`./content/${name}`, import.meta.url), "utf8").trim();
}

const enHome = `
<p>NATL is an open-source <strong>test runner</strong>: scenarios in YAML for <strong>web UI and API</strong>. Write one compact scenario, run it locally or in CI, and keep it when the browser stack changes — swap <code>engine:</code> instead of rewriting the suite.</p>
<p>New here? Open the <a href="getting-started.html">guide</a> and start at Install.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Guide</h3><p>Install, first PASS, then the language block by block.</p></a>
  <a class="card" href="sandbox.html"><h3>Sandbox</h3><p>Live demo page for <code>natl init</code> — login + API ping.</p></a>
  <a class="card" href="agent.html"><h3>Agent</h3><p>Draft NATL YAML from a git diff; GitHub, GitLab, Jenkins.</p></a>
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
<p>NATL — open-source <strong>тест-раннер</strong>: сценарии на YAML для <strong>web UI и API</strong>. Один компактный сценарий, локально или в CI. Сменился браузерный стек — меняете <code>engine:</code>, а не весь сьют.</p>
<p>С нуля? Откройте <a href="getting-started.html">гайд</a> и начните с установки.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Гайд</h3><p>Установка, первый PASS, затем язык по блокам.</p></a>
  <a class="card" href="sandbox.html"><h3>Песочница</h3><p>Живая страница для <code>natl init</code> — логин + ping API.</p></a>
  <a class="card" href="agent.html"><h3>Agent</h3><p>Черновик NATL YAML из git diff; GitHub, GitLab, Jenkins.</p></a>
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
<p>NATL 是开源<strong>测试运行器</strong>：用 YAML 写 <strong>Web UI 与 API</strong> 场景。写一份紧凑场景，本地或 CI 运行；浏览器栈变了，改 <code>engine:</code> 即可，不必整套重写。</p>
<p>第一次用？打开<a href="getting-started.html">指南</a>，从安装开始。</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>指南</h3><p>安装、首次 PASS，再按块看语言。</p></a>
  <a class="card" href="sandbox.html"><h3>沙箱</h3><p><code>natl init</code> 的在线演示页 — 登录 + API ping。</p></a>
  <a class="card" href="agent.html"><h3>Agent</h3><p>从 git diff 生成 NATL YAML 草稿；GitHub / GitLab / Jenkins。</p></a>
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
<p>NATL es un <strong>test runner</strong> de código abierto: escenarios YAML para <strong>UI web y API</strong>. Escribes un escenario compacto, lo corres local o en CI, y lo conservas cuando cambia el stack del navegador: cambias <code>engine:</code>, no toda la suite.</p>
<p>¿Empiezas ahora? Abre la <a href="getting-started.html">guía</a> y empieza por Instalar.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Guía</h3><p>Instalación, primer PASS y el lenguaje por bloques.</p></a>
  <a class="card" href="sandbox.html"><h3>Sandbox</h3><p>Página demo para <code>natl init</code> — login + ping API.</p></a>
  <a class="card" href="agent.html"><h3>Agent</h3><p>Borrador NATL YAML desde un git diff; GitHub, GitLab, Jenkins.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Problemas</h3><p>Fallos habituales y cómo resolverlos.</p></a>
  <a class="card" href="adapters.html"><h3>Adaptadores</h3><p>Playwright por defecto; Selenium y Cypress cuando haga falta.</p></a>
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
<p>NATL separates <strong>what to test</strong> (YAML scenarios) from <strong>how the browser is driven</strong> (adapters). Typical UI flows stay portable when you change <code>engine:</code>.</p>

<h2>Packages</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart LR
  YAML["YAML scenarios"] --> CLI["@natl/cli"]
  CLI --> Core["@natl/core"]
  Core --> Adapters["UI adapters"]
  Core --> HTTP["built-in http"]
  Adapters --> PW["Playwright"]
  Adapters --> SE["Selenium"]
  Adapters --> CY["Cypress"]
</div>
</div>
<ul>
  <li><strong>@natl/cli</strong> — finds files, loads config, filters tags, loads the adapter</li>
  <li><strong>@natl/core</strong> — parse, interpolate, interpret; no browser dependency</li>
  <li><strong>Adapters</strong> — Playwright / Selenium / Cypress as separate packages</li>
  <li><strong>http</strong> — built into core for API-only or <code>with: http</code> blocks</li>
</ul>

<h2>Run path</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart TB
  Run["natl run"] --> Config["Config + YAML"]
  Config --> Parse["Parse + interpolate"]
  Parse --> Interp["Interpreter"]
  Interp --> Choice{"engine"}
  Choice -->|"playwright / selenium / cypress"| UI["UI adapter"]
  Choice -->|"http"| Fetch["HTTP fetch"]
</div>
</div>
<p>Browsers and driver details stay in the adapter. Core passes opaque options like <code>browser</code> and <code>viewport</code> from <code>natl.config.yaml</code>. More design rules: <a href="canon.html">Canon</a>.</p>`;

const ruArch = `
<h1>Архитектура</h1>
<p>NATL разделяет <strong>что тестировать</strong> (YAML-сценарии) и <strong>как водить браузер</strong> (адаптеры). Типичные UI-потоки остаются портативными при смене <code>engine:</code>.</p>

<h2>Пакеты</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart LR
  YAML["YAML-сценарии"] --> CLI["@natl/cli"]
  CLI --> Core["@natl/core"]
  Core --> Adapters["UI-адаптеры"]
  Core --> HTTP["встроенный http"]
  Adapters --> PW["Playwright"]
  Adapters --> SE["Selenium"]
  Adapters --> CY["Cypress"]
</div>
</div>
<ul>
  <li><strong>@natl/cli</strong> — файлы, конфиг, фильтры, загрузка адаптера</li>
  <li><strong>@natl/core</strong> — парсер, интерполяция, интерпретатор; без зависимости от браузера</li>
  <li><strong>Адаптеры</strong> — Playwright / Selenium / Cypress отдельными пакетами</li>
  <li><strong>http</strong> — в core для API-only или блоков <code>with: http</code></li>
</ul>

<h2>Путь прогона</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart TB
  Run["natl run"] --> Config["Конфиг + YAML"]
  Config --> Parse["Парс + интерполяция"]
  Parse --> Interp["Интерпретатор"]
  Interp --> Choice{"engine"}
  Choice -->|"playwright / selenium / cypress"| UI["UI-адаптер"]
  Choice -->|"http"| Fetch["HTTP fetch"]
</div>
</div>
<p>Браузеры и драйвер — зона адаптера. Core передаёт непрозрачные опции вроде <code>browser</code> и <code>viewport</code> из <code>natl.config.yaml</code>. Правила дизайна: <a href="canon.html">Канон</a>.</p>`;

const zhArch = `
<h1>架构</h1>
<p>NATL 把<strong>测什么</strong>（YAML 场景）和<strong>如何驱动浏览器</strong>（适配器）分开。更换 <code>engine:</code> 时，典型 UI 流程仍可移植。</p>

<h2>包</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart LR
  YAML["YAML 场景"] --> CLI["@natl/cli"]
  CLI --> Core["@natl/core"]
  Core --> Adapters["UI 适配器"]
  Core --> HTTP["内置 http"]
  Adapters --> PW["Playwright"]
  Adapters --> SE["Selenium"]
  Adapters --> CY["Cypress"]
</div>
</div>
<ul>
  <li><strong>@natl/cli</strong> — 找文件、加载配置、过滤标签、加载适配器</li>
  <li><strong>@natl/core</strong> — 解析、插值、解释执行；不依赖浏览器</li>
  <li><strong>适配器</strong> — Playwright / Selenium / Cypress 为独立包</li>
  <li><strong>http</strong> — 内置于 core，用于纯 API 或 <code>with: http</code></li>
</ul>

<h2>运行路径</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart TB
  Run["natl run"] --> Config["配置 + YAML"]
  Config --> Parse["解析 + 插值"]
  Parse --> Interp["解释器"]
  Interp --> Choice{"engine"}
  Choice -->|"playwright / selenium / cypress"| UI["UI 适配器"]
  Choice -->|"http"| Fetch["HTTP fetch"]
</div>
</div>
<p>浏览器与驱动细节留在适配器。core 从 <code>natl.config.yaml</code> 传入不透明选项（如 <code>browser</code>、<code>viewport</code>）。设计规则见<a href="canon.html">规范</a>。</p>`;

const esArch = `
<h1>Arquitectura</h1>
<p>NATL separa <strong>qué probar</strong> (escenarios YAML) de <strong>cómo se conduce el navegador</strong> (adaptadores). Los flujos UI típicos siguen siendo portables al cambiar <code>engine:</code>.</p>

<h2>Paquetes</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart LR
  YAML["Escenarios YAML"] --> CLI["@natl/cli"]
  CLI --> Core["@natl/core"]
  Core --> Adapters["Adaptadores UI"]
  Core --> HTTP["http integrado"]
  Adapters --> PW["Playwright"]
  Adapters --> SE["Selenium"]
  Adapters --> CY["Cypress"]
</div>
</div>
<ul>
  <li><strong>@natl/cli</strong> — archivos, config, filtros, carga del adaptador</li>
  <li><strong>@natl/core</strong> — parseo, interpolación, intérprete; sin dependencia del navegador</li>
  <li><strong>Adaptadores</strong> — Playwright / Selenium / Cypress como paquetes aparte</li>
  <li><strong>http</strong> — integrado en core para API-only o bloques <code>with: http</code></li>
</ul>

<h2>Camino de ejecución</h2>
<div class="mermaid-wrap">
<div class="mermaid" data-mermaid>
flowchart TB
  Run["natl run"] --> Config["Config + YAML"]
  Config --> Parse["Parseo + interpolación"]
  Parse --> Interp["Intérprete"]
  Interp --> Choice{"engine"}
  Choice -->|"playwright / selenium / cypress"| UI["Adaptador UI"]
  Choice -->|"http"| Fetch["HTTP fetch"]
</div>
</div>
<p>Navegadores y drivers quedan en el adaptador. Core pasa opciones opacas como <code>browser</code> y <code>viewport</code> desde <code>natl.config.yaml</code>. Reglas de diseño: <a href="canon.html">Canon</a>.</p>`;

const enCanon = `
<h1>Canon</h1>
<table>
<thead><tr><th>I believe</th><th>So</th></tr></thead>
<tbody>
<tr><td>Compact language</td><td>A smoke fits on one screen</td></tr>
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
<tr><td>Компактный язык</td><td>Smoke на один экран</td></tr>
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
<tr><td>紧凑语言</td><td>一个 smoke 放进一屏</td></tr>
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
<tr><td>Lenguaje compacto</td><td>Un smoke cabe en una pantalla</td></tr>
<tr><td>UI + API juntos</td><td><code>with: http</code> en el mismo archivo</td></tr>
<tr><td>Contexto fuera de los pasos</td><td>config / <code>--env</code> / <code>cases:</code></td></tr>
<tr><td>Portable con adaptadores</td><td>Mismo YAML; navegadores = capacidad del adaptador</td></tr>
<tr><td>Techo honesto</td><td>~90% de smokes; el resto, escape hatch</td></tr>
<tr><td>Runner ≠ TMS</td><td>El CLI ejecuta tests — no un dashboard</td></tr>
</tbody>
</table>`;

const sandboxCopy = {
  en: {
    title: "Sandbox",
    lede: `Demo app for <code>natl init</code> and first runs. Selectors below are a <strong>stable contract</strong> — do not rename them lightly.`,
    try: `<strong>Try:</strong> email <code>demo@natl.dev</code>, password <code>secret</code>.`,
    contract: `Contract: <code>#email</code>, <code>#password</code>, <code>#login-btn</code>, <code>.welcome</code>, <code>#ping-api</code>, <code>#api-status</code>. JSON: <a href="sandbox-api.json"><code>sandbox-api.json</code></a>. Offline twin: <code>examples/fixtures/sandbox.html</code>.`,
  },
  ru: {
    title: "Песочница",
    lede: `Демо для <code>natl init</code> и первых прогонов. Селекторы ниже — <strong>стабильный контракт</strong>: не переименовывайте их без нужды.`,
    try: `<strong>Попробуйте:</strong> email <code>demo@natl.dev</code>, пароль <code>secret</code>.`,
    contract: `Контракт: <code>#email</code>, <code>#password</code>, <code>#login-btn</code>, <code>.welcome</code>, <code>#ping-api</code>, <code>#api-status</code>. JSON: <a href="sandbox-api.json"><code>sandbox-api.json</code></a>. Offline-копия: <code>examples/fixtures/sandbox.html</code>.`,
  },
  zh: {
    title: "沙箱",
    lede: `供 <code>natl init</code> 与首次运行使用的演示页。下方选择器是<strong>稳定约定</strong>——请勿轻易改名。`,
    try: `<strong>试用：</strong>邮箱 <code>demo@natl.dev</code>，密码 <code>secret</code>。`,
    contract: `约定：<code>#email</code>、<code>#password</code>、<code>#login-btn</code>、<code>.welcome</code>、<code>#ping-api</code>、<code>#api-status</code>。JSON：<a href="sandbox-api.json"><code>sandbox-api.json</code></a>。离线孪生页：<code>examples/fixtures/sandbox.html</code>。`,
  },
  es: {
    title: "Sandbox",
    lede: `App demo para <code>natl init</code> y las primeras ejecuciones. Los selectores de abajo son un <strong>contrato estable</strong>: no los renombres a la ligera.`,
    try: `<strong>Prueba:</strong> email <code>demo@natl.dev</code>, contraseña <code>secret</code>.`,
    contract: `Contrato: <code>#email</code>, <code>#password</code>, <code>#login-btn</code>, <code>.welcome</code>, <code>#ping-api</code>, <code>#api-status</code>. JSON: <a href="sandbox-api.json"><code>sandbox-api.json</code></a>. Gemelo offline: <code>examples/fixtures/sandbox.html</code>.`,
  },
};

const locales = {
  en: pack(
    "en",
    { title: "NATL", tagline: "YAML test runner" },
    {
      home: "Home",
      guide: "Guide",
      sandbox: "Sandbox",
      agent: "Agent",
      troubleshooting: "Troubleshooting",
      canon: "Canon",
      architecture: "Architecture",
      adapters: "Adapters",
    },
    { language: "Language", theme: "Theme", themeLight: "Light", themeDark: "Dark" },
    { line: "MIT License." },
    {
      headline: "Test web UI and API with YAML.",
      lede: "An open-source test runner. Write scenarios in YAML, run them locally or in CI, keep them when the browser stack changes.",
    },
    {
      home: { title: "Home", html: enHome },
      guide: { title: "Guide", html: load("en-guide.html") },
      sandbox: sandboxCopy.en,
      agent: { title: "Agent", html: load("en-agent.html") },
      troubleshooting: { title: "Troubleshooting", html: enTrouble },
      adapters: { title: "Adapters", html: enAdapters },
      architecture: { title: "Architecture", html: enArch },
      canon: { title: "Canon", html: enCanon },
    },
  ),
  ru: pack(
    "ru",
    { title: "NATL", tagline: "YAML test runner" },
    {
      home: "Главная",
      guide: "Гайд",
      sandbox: "Песочница",
      agent: "Agent",
      troubleshooting: "Сбои",
      canon: "Канон",
      architecture: "Архитектура",
      adapters: "Адаптеры",
    },
    { language: "Язык", theme: "Тема", themeLight: "Светлая", themeDark: "Тёмная" },
    { line: "Лицензия MIT." },
    {
      headline: "Тесты web UI и API на YAML.",
      lede: "Open-source тест-раннер. Пишете сценарии на YAML, гоняете локально или в CI, оставляете их при смене браузерного стека.",
    },
    {
      home: { title: "Главная", html: ruHome },
      guide: { title: "Гайд", html: load("ru-guide.html") },
      sandbox: sandboxCopy.ru,
      agent: { title: "Agent", html: load("ru-agent.html") },
      troubleshooting: { title: "Сбои", html: ruTrouble },
      adapters: { title: "Адаптеры", html: ruAdapters },
      architecture: { title: "Архитектура", html: ruArch },
      canon: { title: "Канон", html: ruCanon },
    },
  ),
  zh: pack(
    "zh-CN",
    { title: "NATL", tagline: "YAML test runner" },
    {
      home: "首页",
      guide: "指南",
      sandbox: "沙箱",
      agent: "Agent",
      troubleshooting: "排错",
      canon: "规范",
      architecture: "架构",
      adapters: "适配器",
    },
    { language: "语言", theme: "主题", themeLight: "浅色", themeDark: "深色" },
    { line: "MIT 许可。" },
    {
      headline: "用 YAML 测 Web UI 与 API。",
      lede: "开源测试运行器。用 YAML 写场景，本地或 CI 跑；浏览器栈变了也不必整套重写。",
    },
    {
      home: { title: "首页", html: zhHome },
      guide: { title: "指南", html: load("zh-guide.html") },
      sandbox: sandboxCopy.zh,
      agent: { title: "Agent", html: load("zh-agent.html") },
      troubleshooting: { title: "排错", html: zhTrouble },
      adapters: { title: "适配器", html: zhAdapters },
      architecture: { title: "架构", html: zhArch },
      canon: { title: "规范", html: zhCanon },
    },
  ),
  es: pack(
    "es",
    { title: "NATL", tagline: "YAML test runner" },
    {
      home: "Inicio",
      guide: "Guía",
      sandbox: "Sandbox",
      agent: "Agent",
      troubleshooting: "Problemas",
      canon: "Canon",
      architecture: "Arquitectura",
      adapters: "Adaptadores",
    },
    { language: "Idioma", theme: "Tema", themeLight: "Claro", themeDark: "Oscuro" },
    { line: "Licencia MIT." },
    {
      headline: "Pruebas de UI web y API en YAML.",
      lede: "Un test runner de código abierto. Escenarios en YAML, local o en CI; se conservan cuando cambia el stack del navegador.",
    },
    {
      home: { title: "Inicio", html: esHome },
      guide: { title: "Guía", html: load("es-guide.html") },
      sandbox: sandboxCopy.es,
      agent: { title: "Agent", html: load("es-agent.html") },
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
