import { readFileSync, writeFileSync } from "node:fs";

function pack(htmlLang, meta, nav, ui, footer, home, pages) {
  return { meta: { htmlLang, ...meta }, nav, ui, footer, home, pages };
}

function load(name) {
  return readFileSync(new URL(`./content/${name}`, import.meta.url), "utf8").trim();
}

const enHome = `
<p class="muted">Hi — I'm <strong>Arslan</strong>, and I built NATL because I was tired of rewriting the same smoke tests every time the stack changed.</p>
<p>This is a short open-source YAML runner for <strong>web UI and API</strong>. You write one compact scenario. You run it locally or in CI. When the team swaps Playwright for something else, you change <code>engine:</code> — not the whole suite.</p>
<p>If you're new here: take the <strong>course</strong>. Don't skim the canon first. Canon is for after you've seen a green <code>PASS</code>.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Course</h3><p>Lectures 0–8 + a problem set. This is the front door.</p></a>
  <a class="card" href="syntax.html"><h3>Syntax</h3><p>Full language map — every field and verb I support.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Troubleshooting</h3><p>When it fails (and it will), start here before you blame YAML.</p></a>
  <a class="card" href="adapters.html"><h3>Adapters</h3><p>Playwright by default. Selenium and Cypress when you need them.</p></a>
</div>
<h2>Install in one breath</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p class="muted">Then open the <a href="getting-started.html">course</a>. I'll meet you in Lecture 0.</p>
<h2>Links</h2>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a> — scenarios I keep in the repo</li>
</ul>`;

const ruHome = `
<p class="muted">Привет — я <strong>Арслан</strong>, и я сделал NATL, потому что устал переписывать одни и те же smoke-тесты каждый раз, когда менялся стек.</p>
<p>Короткий open-source YAML-раннер для <strong>web UI и API</strong>. Один компактный сценарий. Локально или в CI. Сменили Playwright — меняете <code>engine:</code>, а не весь сьют.</p>
<p>Новичкам: идите в <strong>курс</strong>. Канон — после первого зелёного <code>PASS</code>.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Курс</h3><p>Лекции 0–8 и задание. Это вход.</p></a>
  <a class="card" href="syntax.html"><h3>Синтаксис</h3><p>Полная карта языка — все поля и глаголы.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Сбои</h3><p>Когда FAIL — сюда, а не сразу винить YAML.</p></a>
  <a class="card" href="adapters.html"><h3>Адаптеры</h3><p>Playwright по умолчанию. Selenium и Cypress — когда нужно.</p></a>
</div>
<h2>Установка одним дыханием</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p class="muted">Потом — <a href="getting-started.html">курс</a>. Увидимся на лекции 0.</p>
<h2>Ссылки</h2>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>`;

const zhHome = `
<p class="muted">你好 — 我是 <strong>Arslan</strong>。我做 NATL，是因为每次技术栈一变，我就要重写同一批 smoke。</p>
<p>这是一个简短的开源 YAML 运行器，面向 <strong>Web UI 与 API</strong>。写一份紧凑场景，本地或 CI 跑。团队换 Playwright 时，改 <code>engine:</code>，不必整套重写。</p>
<p>新人请先上<strong>课程</strong>。规范页留到第一次绿色 <code>PASS</code> 之后。</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>课程</h3><p>第 0–8 讲 + 练习题。从这里进门。</p></a>
  <a class="card" href="syntax.html"><h3>语法</h3><p>完整语言地图——我支持的每个字段与动词。</p></a>
  <a class="card" href="troubleshooting.html"><h3>排错</h3><p>失败时先看这里，再怪 YAML。</p></a>
  <a class="card" href="adapters.html"><h3>适配器</h3><p>默认 Playwright；需要时再用 Selenium / Cypress。</p></a>
</div>
<h2>一口气安装</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p class="muted">然后打开<a href="getting-started.html">课程</a>。第 0 讲见。</p>`;

const esHome = `
<p class="muted">Hola — soy <strong>Arslan</strong>. Creé NATL porque estaba harto de reescribir los mismos smokes cada vez que cambiaba el stack.</p>
<p>Un runner YAML corto de código abierto para <strong>UI web y API</strong>. Un escenario compacto. Local o en CI. Si el equipo cambia Playwright, cambias <code>engine:</code>, no toda la suite.</p>
<p>Si empiezas: haz el <strong>curso</strong>. El canon, después del primer <code>PASS</code> verde.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Curso</h3><p>Lecciones 0–8 + ejercicios. Esta es la puerta.</p></a>
  <a class="card" href="syntax.html"><h3>Sintaxis</h3><p>Mapa completo del lenguaje — cada campo y verbo.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Problemas</h3><p>Cuando falle, empieza aquí antes de culpar al YAML.</p></a>
  <a class="card" href="adapters.html"><h3>Adaptadores</h3><p>Playwright por defecto. Selenium y Cypress cuando haga falta.</p></a>
</div>
<h2>Instalar de un aliento</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p class="muted">Luego el <a href="getting-started.html">curso</a>. Nos vemos en la lección 0.</p>`;

/* Keep shorter pages from previous voice — load inline for trouble/adapters/arch/canon */
const enTrouble = `
<h1>Troubleshooting</h1>
<p>When something breaks, I look here before I rewrite the scenario. You should too.</p>
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
  <li>Prefer stable <code>#id</code> over long CSS chains</li>
  <li>Check the screenshot under <code>artifacts/</code></li>
</ul>
<h2>YAML indentation</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP examples hang or fail</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<h2>Wrong engine / adapter missing</h2>
<pre><code>natl engines
npm install -g @natl/adapter-playwright</code></pre>
<p>Still stuck? Open an issue on <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a> with the FAIL line and your OS.</p>
<p class="muted">— Arslan</p>`;

const ruTrouble = `
<h1>Сбои</h1>
<p>Когда ломается — сначала сюда, потом уже переписывать сценарий.</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>Ошибки браузера / Chromium</h2>
<pre><code>npx playwright install chromium
npx playwright install --with-deps chromium</code></pre>
<h2><code>FAIL … assert</code> / элемент не найден</h2>
<ul>
  <li>Селектор ещё верный?</li>
  <li>Стабильный <code>#id</code> лучше длинных цепочек</li>
  <li>Скрин в <code>artifacts/</code></li>
</ul>
<h2>Отступы YAML</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP зависает</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<h2>Неверный engine</h2>
<pre><code>natl engines
npm install -g @natl/adapter-playwright</code></pre>
<p>Всё ещё плохо? Issue на <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a> — FAIL и OS.</p>
<p class="muted">— Арслан</p>`;

const zhTrouble = `
<h1>排错</h1>
<p>出问题时，我先看这里，再改场景。你也应该这样。</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>浏览器 / Chromium 错误</h2>
<pre><code>npx playwright install chromium
npx playwright install --with-deps chromium</code></pre>
<h2><code>FAIL … assert</code> / 找不到元素</h2>
<ul>
  <li>选择器还对吗？</li>
  <li>优先稳定的 <code>#id</code></li>
  <li>看 <code>artifacts/</code> 里的截图</li>
</ul>
<h2>YAML 缩进</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP 示例卡住</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<p>仍卡住？在 <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a> 开 issue，附上 FAIL 与系统信息。</p>
<p class="muted">—— Arslan</p>`;

const esTrouble = `
<h1>Problemas frecuentes</h1>
<p>Cuando algo falla, miro aquí antes de reescribir el escenario. Tú también deberías.</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>Errores de navegador / Chromium</h2>
<pre><code>npx playwright install chromium
npx playwright install --with-deps chromium</code></pre>
<h2><code>FAIL … assert</code> / elemento no encontrado</h2>
<ul>
  <li>¿Sigue bien el selector?</li>
  <li>Prefiere <code>#id</code> estable</li>
  <li>Revisa la captura en <code>artifacts/</code></li>
</ul>
<h2>Indentación YAML</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP se cuelga</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<p>¿Sigues atascado? Abre un issue en <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a>.</p>
<p class="muted">— Arslan</p>`;

const enAdapters = `
<h1>Adapters</h1>
<p>The YAML is the contract. Adapters drive a browser — or skip it for HTTP.</p>
<table>
<thead><tr><th>engine</th><th>Package</th><th>When I pick it</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Default. New projects. CI.</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>Existing WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Cypress-heavy teams (MVP bridge)</td></tr>
<tr><td><code>http</code></td><td>built into <code>@natl/core</code></td><td>API-only scenarios</td></tr>
</tbody>
</table>
<pre><code>engine: playwright
browser: chromium
headless: true</code></pre>
<pre><code>natl run suite.yaml --engine selenium</code></pre>
<p>UI + HTTP in one file → <code>with: http</code> (see the <a href="getting-started.html#l6">course, Lecture 6</a>).</p>
<p class="muted">Browsers are an adapter capability — not a hard-coded matrix in the language.</p>`;

const ruAdapters = `
<h1>Адаптеры</h1>
<p>YAML — контракт. Adapter водит браузер — или обходится HTTP.</p>
<table>
<thead><tr><th>engine</th><th>Пакет</th><th>Когда беру</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>По умолчанию. Новые проекты. CI.</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>Уже есть WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Команды на Cypress (MVP)</td></tr>
<tr><td><code>http</code></td><td>встроен в <code>@natl/core</code></td><td>Только API</td></tr>
</tbody>
</table>
<p>UI + HTTP → <code>with: http</code> (см. <a href="getting-started.html#l6">курс, лекция 6</a>).</p>`;

const zhAdapters = `
<h1>适配器</h1>
<p>YAML 是契约。适配器驱动浏览器——或对 HTTP 跳过浏览器。</p>
<table>
<thead><tr><th>engine</th><th>包</th><th>我何时选用</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>默认。新项目。CI。</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>已有 WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>重度 Cypress 团队（MVP）</td></tr>
<tr><td><code>http</code></td><td>内置于 <code>@natl/core</code></td><td>仅 API</td></tr>
</tbody>
</table>
<p>同一文件里 UI + HTTP → <code>with: http</code>（见<a href="getting-started.html#l6">课程第 6 讲</a>）。</p>`;

const esAdapters = `
<h1>Adaptadores</h1>
<p>El YAML es el contrato. El adaptador conduce el navegador — o lo omite para HTTP.</p>
<table>
<thead><tr><th>engine</th><th>Paquete</th><th>Cuándo lo elijo</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Por defecto. Proyectos nuevos. CI.</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver / Grid existente</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Equipos Cypress (MVP)</td></tr>
<tr><td><code>http</code></td><td>integrado en <code>@natl/core</code></td><td>Solo API</td></tr>
</tbody>
</table>
<p>UI + HTTP en un archivo → <code>with: http</code> (ver <a href="getting-started.html#l6">curso, lección 6</a>).</p>`;

const enArch = `
<h1>Architecture</h1>
<p>Mental model I draw on a whiteboard:</p>
<ul>
  <li><strong>You write YAML</strong> — what to test</li>
  <li><strong>@natl/cli</strong> — finds files, loads config, filters tags</li>
  <li><strong>@natl/core</strong> — parses, interpolates, runs the interpreter</li>
  <li><strong>Adapter</strong> — Playwright / Selenium / Cypress — or built-in <code>http</code></li>
</ul>
<p>Typical flows stay portable when you change <code>engine:</code>. Rare edges live in the <a href="canon.html">canon</a>.</p>`;

const ruArch = `
<h1>Архитектура</h1>
<p>Как я рисую это на доске:</p>
<ul>
  <li><strong>Вы пишете YAML</strong> — что тестировать</li>
  <li><strong>@natl/cli</strong> — файлы, конфиг, фильтры</li>
  <li><strong>@natl/core</strong> — парсер, интерполяция, интерпретатор</li>
  <li><strong>Adapter</strong> — Playwright / Selenium / Cypress — или встроенный <code>http</code></li>
</ul>
<p>Типичные потоки портативны при смене <code>engine:</code>. Крайние случаи — в <a href="canon.html">каноне</a>.</p>`;

const zhArch = `
<h1>架构</h1>
<p>我在白板上画的心智模型：</p>
<ul>
  <li><strong>你写 YAML</strong> — 测什么</li>
  <li><strong>@natl/cli</strong> — 找文件、加载配置、过滤标签</li>
  <li><strong>@natl/core</strong> — 解析、插值、解释执行</li>
  <li><strong>适配器</strong> — Playwright / Selenium / Cypress — 或内置 <code>http</code></li>
</ul>
<p>换 <code>engine:</code> 时典型流程仍可移植。边角情况见<a href="canon.html">规范</a>。</p>`;

const esArch = `
<h1>Arquitectura</h1>
<p>El modelo mental que dibujo en la pizarra:</p>
<ul>
  <li><strong>Escribes YAML</strong> — qué probar</li>
  <li><strong>@natl/cli</strong> — archivos, config, filtros</li>
  <li><strong>@natl/core</strong> — parseo, interpolación, intérprete</li>
  <li><strong>Adaptador</strong> — Playwright / Selenium / Cypress — o <code>http</code> integrado</li>
</ul>
<p>Los flujos típicos siguen siendo portables al cambiar <code>engine:</code>. Los bordes raros están en el <a href="canon.html">canon</a>.</p>`;

const enCanon = `
<h1>Canon</h1>
<p>These aren't slogans. They're the rules I refuse to break while growing NATL.</p>
<table>
<thead><tr><th>I believe</th><th>So</th></tr></thead>
<tbody>
<tr><td>Short language</td><td>A smoke fits on one screen</td></tr>
<tr><td>UI + API together</td><td><code>with: http</code> in the same file</td></tr>
<tr><td>Context outside steps</td><td>config / <code>--env</code> / <code>cases:</code> — not <code>if: mobile</code> everywhere</td></tr>
<tr><td>Portable via adapters</td><td>Same YAML; browsers = adapter capability</td></tr>
<tr><td>Honest ceiling</td><td>~90% of smokes; escape hatches for the rest</td></tr>
<tr><td>Runner ≠ TMS</td><td>CLI runs tests — no dashboard product</td></tr>
</tbody>
</table>
<p class="muted">— Arslan</p>`;

const ruCanon = `
<h1>Канон</h1>
<p>Не слоганы. Правила, которые я не ломаю, пока ращу NATL.</p>
<table>
<thead><tr><th>Верю</th><th>Значит</th></tr></thead>
<tbody>
<tr><td>Короткий язык</td><td>Smoke на один экран</td></tr>
<tr><td>UI + API вместе</td><td><code>with: http</code> в одном файле</td></tr>
<tr><td>Контекст вне шагов</td><td>config / <code>--env</code> / <code>cases:</code> — не <code>if: mobile</code> везде</td></tr>
<tr><td>Портативность через адаптеры</td><td>Тот же YAML; браузеры = capability адаптера</td></tr>
<tr><td>Честный потолок</td><td>~90% smokes; остальное — escape hatch</td></tr>
<tr><td>Раннер ≠ TMS</td><td>CLI гоняет тесты — без дашборд-продукта</td></tr>
</tbody>
</table>
<p class="muted">— Арслан</p>`;

const zhCanon = `
<h1>规范</h1>
<p>这些不是口号。是我在扩展 NATL 时拒绝打破的规则。</p>
<table>
<thead><tr><th>我相信</th><th>因此</th></tr></thead>
<tbody>
<tr><td>短语言</td><td>一个 smoke 放进一屏</td></tr>
<tr><td>UI + API 一起</td><td>同一文件里 <code>with: http</code></td></tr>
<tr><td>上下文在步骤外</td><td>config / <code>--env</code> / <code>cases:</code> — 不要满屏 <code>if: mobile</code></td></tr>
<tr><td>靠适配器可移植</td><td>同一份 YAML；浏览器 = 适配器能力</td></tr>
<tr><td>诚实的能力边界</td><td>~90% smoke；其余用逃生舱</td></tr>
<tr><td>运行器 ≠ TMS</td><td>CLI 跑测试 — 不是仪表盘产品</td></tr>
</tbody>
</table>
<p class="muted">—— Arslan</p>`;

const esCanon = `
<h1>Canon</h1>
<p>No son eslóganes. Son las reglas que me niego a romper mientras crece NATL.</p>
<table>
<thead><tr><th>Creo</th><th>Así que</th></tr></thead>
<tbody>
<tr><td>Lenguaje corto</td><td>Un smoke cabe en una pantalla</td></tr>
<tr><td>UI + API juntos</td><td><code>with: http</code> en el mismo archivo</td></tr>
<tr><td>Contexto fuera de los pasos</td><td>config / <code>--env</code> / <code>cases:</code> — no <code>if: mobile</code> por todas partes</td></tr>
<tr><td>Portable con adaptadores</td><td>Mismo YAML; navegadores = capacidad del adaptador</td></tr>
<tr><td>Techo honesto</td><td>~90% de smokes; el resto, escape hatch</td></tr>
<tr><td>Runner ≠ TMS</td><td>El CLI ejecuta tests — no un dashboard</td></tr>
</tbody>
</table>
<p class="muted">— Arslan</p>`;

const locales = {
  en: pack(
    "en",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Home",
      gettingStarted: "Course",
      syntax: "Syntax",
      troubleshooting: "Troubleshooting",
      canon: "Canon",
      architecture: "Architecture",
      adapters: "Adapters",
    },
    { language: "Language", theme: "Theme", themeLight: "Light", themeDark: "Dark" },
    { line: "Built by Arslan Ahmetjanov · MIT License." },
    {
      headline: "This is NATL.",
      lede: "I'm Arslan. I built a short YAML runner for web UI and API — so you can write the test once and keep it when the stack moves.",
    },
    {
      home: { title: "Home", html: enHome },
      "getting-started": { title: "Course", html: load("en-course.html") },
      syntax: { title: "Syntax", html: load("en-syntax.html") },
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
      gettingStarted: "Курс",
      syntax: "Синтаксис",
      troubleshooting: "Сбои",
      canon: "Канон",
      architecture: "Архитектура",
      adapters: "Адаптеры",
    },
    { language: "Язык", theme: "Тема", themeLight: "Светлая", themeDark: "Тёмная" },
    { line: "Сделал Арслан Ахметжанов · лицензия MIT." },
    {
      headline: "Это NATL.",
      lede: "Я Арслан. Короткий YAML-раннер для web UI и API — чтобы написать тест один раз и не выкидывать его при смене стека.",
    },
    {
      home: { title: "Главная", html: ruHome },
      "getting-started": { title: "Курс", html: load("ru-course.html") },
      syntax: { title: "Синтаксис", html: load("ru-syntax.html") },
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
      gettingStarted: "课程",
      syntax: "语法",
      troubleshooting: "排错",
      canon: "规范",
      architecture: "架构",
      adapters: "适配器",
    },
    { language: "语言", theme: "主题", themeLight: "浅色", themeDark: "深色" },
    { line: "作者 Arslan Ahmetjanov · MIT 许可。" },
    {
      headline: "这就是 NATL。",
      lede: "我是 Arslan。短 YAML 运行器，面向 Web UI 与 API——写一次，栈变了也不必整套重来。",
    },
    {
      home: { title: "首页", html: zhHome },
      "getting-started": { title: "课程", html: load("zh-course.html") },
      syntax: { title: "语法", html: load("zh-syntax.html") },
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
      gettingStarted: "Curso",
      syntax: "Sintaxis",
      troubleshooting: "Problemas",
      canon: "Canon",
      architecture: "Arquitectura",
      adapters: "Adaptadores",
    },
    { language: "Idioma", theme: "Tema", themeLight: "Claro", themeDark: "Oscuro" },
    { line: "Hecho por Arslan Ahmetjanov · licencia MIT." },
    {
      headline: "Esto es NATL.",
      lede: "Soy Arslan. Un runner YAML corto para UI web y API — escribes el test una vez y lo conservas cuando cambia el stack.",
    },
    {
      home: { title: "Inicio", html: esHome },
      "getting-started": { title: "Curso", html: load("es-course.html") },
      syntax: { title: "Sintaxis", html: load("es-syntax.html") },
      troubleshooting: { title: "Problemas", html: esTrouble },
      adapters: { title: "Adaptadores", html: esAdapters },
      architecture: { title: "Arquitectura", html: esArch },
      canon: { title: "Canon", html: esCanon },
    },
  ),
};

for (const [name, data] of Object.entries(locales)) {
  writeFileSync(`docs/i18n/${name}.json`, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", name, "course", data.pages["getting-started"].html.length, "syntax", data.pages.syntax.html.length);
}
