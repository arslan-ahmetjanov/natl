import { writeFileSync } from "node:fs";

function pack(htmlLang, meta, nav, ui, footer, home, pages) {
  return { meta: { htmlLang, ...meta }, nav, ui, footer, home, pages };
}

/* ─── English (source of truth, CS50 / first-person) ─── */

const enHome = `
<p class="muted">Hi — I'm <strong>Arslan</strong>, and I built NATL because I was tired of rewriting the same smoke tests every time the stack changed.</p>
<p>This is a short open-source YAML runner for <strong>web UI and API</strong>. You write one compact scenario. You run it locally or in CI. When the team swaps Playwright for something else, you change <code>engine:</code> — not the whole suite.</p>
<p>If you're new here: start with the tutorial. Don't skim the canon first. Canon is for after you've seen a green <code>PASS</code>.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Tutorial</h3><p>Install, run a login, celebrate the first PASS. This is the front door.</p></a>
  <a class="card" href="syntax.html"><h3>Syntax</h3><p>The verbs I use every day — with examples, not theory.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Troubleshooting</h3><p>When it fails (and it will), start here before you blame YAML.</p></a>
  <a class="card" href="adapters.html"><h3>Adapters</h3><p>Playwright by default. Selenium and Cypress when you need them.</p></a>
</div>
<h2>Install in one breath</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p class="muted">Then go to the <a href="getting-started.html">tutorial</a>. I'll meet you there.</p>
<h2>Links</h2>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a> — real scenarios I keep in the repo</li>
</ul>`;

const enGs = `
<h1>Tutorial</h1>
<p>Welcome. In the next few minutes you'll install NATL, run a login scenario I already wrote for you, and see <code>PASS</code> in the terminal. That's the whole point of this page.</p>
<p class="muted">This is me teaching the path I wish I'd had — short, concrete, no detours.</p>

<h2>0. What you need</h2>
<ul>
  <li>Node.js <strong>18+</strong> (<code>node -v</code>)</li>
  <li>A terminal you're not afraid of</li>
  <li>About ten minutes</li>
</ul>

<h2>1. Install</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p>If <code>natl --version</code> prints a number, you're in. If not — jump to <a href="troubleshooting.html">Troubleshooting</a>.</p>

<h2>2. Your first green run (my examples)</h2>
<p>Clone the repo and run the login I keep under <code>examples/</code>. It hits a local HTML fixture — no flaky public site.</p>
<pre><code>git clone https://github.com/arslan-ahmetjanov/natl.git
cd natl/examples
natl run login.yaml</code></pre>
<p>You should see something like <code>✓ PASS</code>. That feeling? Keep it. Everything else in NATL is just more of that.</p>

<h2>3. Read the scenario with me</h2>
<pre><code>name: Login smoke
engine: playwright
vars:
  base_url: ./fixtures/shop.html
  user: demo@test.com
  pass: secret
steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - fill: "#password"
    with: $pass
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Добро пожаловать"</code></pre>
<p>Top to bottom: name the test, pick an engine, set variables, then steps. <code>$user</code> means “take it from <code>vars</code>”. Selectors are just CSS — the same ones you'd use in DevTools.</p>

<h2>4. Make it yours</h2>
<p>Change the assert text to something wrong on purpose, run again, watch it <code>FAIL</code> with a file and line. Then fix it. That's how you learn the runner — break it safely.</p>
<pre><code>natl run login.yaml</code></pre>

<h2>5. Scaffold your own project</h2>
<pre><code>mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>
<p><code>natl init</code> drops a tiny project: config, an example test, <code>.env.example</code>. Start there when you're ready to leave my fixtures behind.</p>

<h2>6. Where next?</h2>
<ul>
  <li><a href="syntax.html">Syntax</a> — the verbs</li>
  <li><a href="troubleshooting.html">Troubleshooting</a> — when PASS refuses to show up</li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a> — POM, cases, HTTP</li>
</ul>
<p class="muted">— Arslan</p>`;

const enSyntax = `
<h1>Syntax</h1>
<p>I designed NATL so a smoke test fits on one screen. Here's the vocabulary I actually use.</p>

<h2>Anatomy of a file</h2>
<pre><code>name: Checkout smoke
engine: playwright
tags: [smoke]
timeout: 15000
vars:
  base_url: https://example.com
steps:
  - goto: $base_url
  - click: "#buy"
  - assert: ".ok"
    visible: true</code></pre>

<h2>Cheat sheet — UI</h2>
<table>
<thead><tr><th>Step</th><th>What I mean by it</th></tr></thead>
<tbody>
<tr><td><code>goto</code></td><td>Open a URL or local file</td></tr>
<tr><td><code>fill</code> + <code>with</code></td><td>Type into an input</td></tr>
<tr><td><code>click</code> / <code>tap</code></td><td>Same action — pick the word you like</td></tr>
<tr><td><code>select</code> / <code>check</code></td><td>Forms</td></tr>
<tr><td><code>assert</code></td><td>Check text, visibility, URL, …</td></tr>
<tr><td><code>wait</code></td><td>Only for special cases — auto-wait already covers “become visible”</td></tr>
<tr><td><code>log</code></td><td>Print something helpful</td></tr>
</tbody>
</table>

<h2>Variables</h2>
<p><code>$name</code> from <code>vars</code>. Secrets from the environment: <code>$env.KEY</code> / <code>$secret.KEY</code>. Don't commit real passwords — use <code>.env</code>.</p>

<h2>POM without ceremony</h2>
<p>Put selectors in a page file, call them with <code>do:</code>:</p>
<pre><code>imports:
  - pages/login.yaml
steps:
  - goto: $base_url
  - do: login.login
    user: $user
    pass: $pass</code></pre>
<p>See <code>examples/pom_login.yaml</code> in the repo.</p>

<h2>Data-driven with cases</h2>
<pre><code>cases:
  - { name: a, user: a@test.com, expect: "Welcome A" }
  - { name: b, user: b@test.com, expect: "Welcome B" }
steps:
  - fill: "#email"
    with: $user
  - assert: ".welcome"
    text: $expect</code></pre>

<h2>HTTP next to UI</h2>
<pre><code>steps:
  - do: login.login
    user: $user
    pass: $pass
  - with: http
    steps:
      - get: $api_base/get
        save: ping
      - assert: $ping.status == 200</code></pre>
<p class="muted">Fuller notes live in the package READMEs — this page is the map I want in your head.</p>`;

const enTrouble = `
<h1>Troubleshooting</h1>
<p>When something breaks, I look here before I rewrite the scenario. You should too.</p>

<h2><code>natl: command not found</code></h2>
<p>The global install didn't land on your <code>PATH</code>. Try:</p>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
# ensure that bin directory is on PATH
natl --version</code></pre>

<h2>Browser / Chromium errors</h2>
<pre><code>npx playwright install chromium
# or, with system deps on Linux CI:
npx playwright install --with-deps chromium</code></pre>

<h2><code>FAIL … assert</code> / element not found</h2>
<ul>
  <li>Open the page yourself — is the selector still right?</li>
  <li>Prefer stable <code>#id</code> / roles over long CSS chains</li>
  <li>Check the screenshot under <code>artifacts/</code> next to the scenario</li>
</ul>

<h2>YAML indentation</h2>
<p>NATL is YAML. Two spaces. If the IDE screams, trust it. Sibling keys belong under the step:</p>
<pre><code>- fill: "#email"
  with: $user</code></pre>

<h2>HTTP examples hang or fail</h2>
<p>My HTTP demos expect a local stub:</p>
<pre><code>node stubs/echo-server.mjs
# then in another terminal:
natl run http_only.yaml</code></pre>

<h2>Wrong engine / adapter missing</h2>
<pre><code>natl engines
npm install -g @natl/adapter-playwright</code></pre>
<p>Default UI engine is Playwright. Say so in <code>natl.config.yaml</code> or the scenario.</p>

<h2>Still stuck?</h2>
<p>Open an issue on <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a> with the FAIL line and your OS. I'll read it.</p>
<p class="muted">— Arslan</p>`;

const enAdapters = `
<h1>Adapters</h1>
<p>The YAML is the contract. Adapters are how we drive a browser — or skip the browser for HTTP.</p>
<p>I default to Playwright because it's the happiest path for most people. Selenium and Cypress are there when your team already standardized on them.</p>
<table>
<thead><tr><th>engine</th><th>Package</th><th>When I pick it</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Default. New projects. CI.</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>Existing WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Cypress-heavy teams (MVP bridge)</td></tr>
<tr><td><code>http</code></td><td>built into <code>@natl/core</code></td><td>API-only scenarios</td></tr>
</tbody>
</table>
<pre><code># natl.config.yaml
engine: playwright
browser: chromium
headless: true</code></pre>
<pre><code>natl run suite.yaml --engine selenium</code></pre>
<h2>UI + HTTP in one file</h2>
<pre><code>engine: playwright
steps:
  - goto: $base_url
  - with: http
    steps:
      - get: $api_base/get
        save: ping
      - assert: $ping.status == 200</code></pre>
<p class="muted">Browsers are an adapter capability — NATL doesn't hard-code a matrix in the language.</p>`;

const enArch = `
<h1>Architecture</h1>
<p>Here's the mental model I use when I explain NATL on a whiteboard:</p>
<ul>
  <li><strong>You write YAML</strong> — what to test</li>
  <li><strong>@natl/core</strong> — parses it, runs steps, talks HTTP</li>
  <li><strong>@natl/cli</strong> — the <code>natl</code> command you type</li>
  <li><strong>adapters</strong> — how clicks and asserts hit a real browser</li>
</ul>
<pre><code>YAML  →  CLI  →  core  →  adapter-playwright (or selenium / cypress)
                     ↘  http (built-in)</code></pre>
<p>That's why swapping engines is a config change for typical flows. Edge cases will always exist — I try to be honest about that in the <a href="canon.html">canon</a>.</p>
<p class="muted">Monorepo: <code>core/</code>, <code>adapter-*</code>, <code>cli/</code>, <code>examples/</code>, <code>docs/</code>.</p>`;

const enCanon = `
<h1>Canon</h1>
<p>These aren't slogans. They're the rules I refuse to break while growing NATL.</p>
<table>
<thead><tr><th>I believe</th><th>So I build</th></tr></thead>
<tbody>
<tr><td>Tests should be short</td><td>Compact YAML + <code>do:</code> for POM</td></tr>
<tr><td>UI and API belong together</td><td>One steps list, <code>with: http</code></td></tr>
<tr><td>Stands change more than flows</td><td><code>--env</code>, vars, cases — not <code>if: mobile</code> in every file</td></tr>
<tr><td>Engines come and go</td><td>Portability via adapters</td></tr>
<tr><td>Honesty beats marketing</td><td>~most smoke ports; escape hatches for the weird tail</td></tr>
<tr><td>A runner is not a TMS</td><td>No dashboard in the CLI</td></tr>
</tbody>
</table>
<p>If you propose a new verb, I ask one question: <em>does a short fullstack smoke need this in the built-in ~90%?</em> If not, it waits.</p>
<p class="muted">— Arslan</p>`;

/* ─── Russian (full peer to EN) ─── */

const ruHome = `
<p class="muted">Привет — я <strong>Арслан</strong>, и я сделал NATL, потому что устал переписывать одни и те же smoke-тесты каждый раз, когда менялся стек.</p>
<p>Это короткий open-source YAML-раннер для <strong>web UI и API</strong>. Один компактный сценарий. Локально или в CI. Сменился Playwright на другой engine — меняете <code>engine:</code>, а не весь набор.</p>
<p>Если вы здесь впервые: начните с туториала. Канон — потом, когда увидите первый зелёный <code>PASS</code>.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Туториал</h3><p>Установка, login, первый PASS. Входная дверь.</p></a>
  <a class="card" href="syntax.html"><h3>Синтаксис</h3><p>Глаголы, которыми я пользуюсь каждый день.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Troubleshooting</h3><p>Когда падает — сюда, до того как винить YAML.</p></a>
  <a class="card" href="adapters.html"><h3>Адаптеры</h3><p>Playwright по умолчанию. Selenium и Cypress — по нужде.</p></a>
</div>
<h2>Установка одним дыханием</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p class="muted">Дальше — <a href="getting-started.html">туториал</a>.</p>
<ul>
  <li><a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a></li>
  <li><a href="https://www.npmjs.com/package/@natl/cli">npm @natl/cli</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>`;

const ruGs = `
<h1>Туториал</h1>
<p>Через несколько минут вы поставите NATL, прогоните login, который я уже написал, и увидите <code>PASS</code>. Ради этого и страница.</p>
<p class="muted">Я объясняю так, как хотел бы, чтобы объяснили мне — коротко и по делу.</p>
<h2>0. Что нужно</h2>
<ul>
  <li>Node.js <strong>18+</strong></li>
  <li>Терминал</li>
  <li>Минут десять</li>
</ul>
<h2>1. Установка</h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>
<p>Видите версию — вы внутри. Нет — <a href="troubleshooting.html">Troubleshooting</a>.</p>
<h2>2. Первый зелёный прогон</h2>
<pre><code>git clone https://github.com/arslan-ahmetjanov/natl.git
cd natl/examples
natl run login.yaml</code></pre>
<p>Локальный HTML-fixture, без чужого продакшена. Должны увидеть <code>✓ PASS</code>.</p>
<h2>3. Читаем сценарий вместе</h2>
<pre><code>name: Login smoke
engine: playwright
vars:
  base_url: ./fixtures/shop.html
  user: demo@test.com
  pass: secret
steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Добро пожаловать"</code></pre>
<p>Имя, engine, переменные, шаги. <code>$user</code> — из <code>vars</code>. Селекторы — обычный CSS.</p>
<h2>4. Сломайте специально</h2>
<p>Поменяйте текст assert на неверный, снова <code>natl run login.yaml</code>, прочитайте <code>FAIL</code> с файлом и строкой — и почините. Так учат мышцы.</p>
<h2>5. Свой проект</h2>
<pre><code>mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>
<h2>6. Дальше</h2>
<ul>
  <li><a href="syntax.html">Синтаксис</a></li>
  <li><a href="troubleshooting.html">Troubleshooting</a></li>
  <li><a href="https://github.com/arslan-ahmetjanov/natl/tree/main/examples">examples/</a></li>
</ul>
<p class="muted">— Арслан</p>`;

const ruSyntax = `
<h1>Синтаксис</h1>
<p>Я делал NATL так, чтобы smoke помещался на один экран. Вот словарь, которым пользуюсь сам.</p>
<h2>Анатомия файла</h2>
<pre><code>name: Checkout smoke
engine: playwright
tags: [smoke]
vars:
  base_url: https://example.com
steps:
  - goto: $base_url
  - click: "#buy"
  - assert: ".ok"
    visible: true</code></pre>
<h2>Шпаргалка — UI</h2>
<table>
<thead><tr><th>Шаг</th><th>Смысл</th></tr></thead>
<tbody>
<tr><td><code>goto</code></td><td>Открыть URL или локальный файл</td></tr>
<tr><td><code>fill</code> + <code>with</code></td><td>Ввод в поле</td></tr>
<tr><td><code>click</code> / <code>tap</code></td><td>Одно и то же</td></tr>
<tr><td><code>assert</code></td><td>Проверка текста, видимости, URL…</td></tr>
<tr><td><code>wait</code></td><td>Только особые случаи — auto-wait уже ждёт появления</td></tr>
</tbody>
</table>
<h2>Переменные</h2>
<p><code>$name</code> из <code>vars</code>. Секреты: <code>$env.KEY</code> / <code>$secret.KEY</code>. Реальные пароли — в <code>.env</code>, не в git.</p>
<h2>POM</h2>
<pre><code>imports:
  - pages/login.yaml
steps:
  - do: login.login
    user: $user
    pass: $pass</code></pre>
<h2>cases и HTTP</h2>
<pre><code>cases:
  - { name: a, user: a@test.com, expect: "Welcome A" }
steps:
  - fill: "#email"
    with: $user
  - assert: ".welcome"
    text: $expect</code></pre>
<pre><code>- with: http
  steps:
    - get: $api_base/get
      save: ping
    - assert: $ping.status == 200</code></pre>`;

const ruTrouble = `
<h1>Troubleshooting</h1>
<p>Когда ломается — сначала сюда, потом уже переписывать сценарий.</p>
<h2><code>natl: command not found</code></h2>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npm prefix -g
natl --version</code></pre>
<h2>Ошибки Chromium / browser</h2>
<pre><code>npx playwright install chromium
npx playwright install --with-deps chromium</code></pre>
<h2>FAIL / элемент не найден</h2>
<ul>
  <li>Селектор ещё актуален?</li>
  <li>Лучше стабильный <code>#id</code>, чем хрупкая цепочка</li>
  <li>Смотрите screenshot в <code>artifacts/</code></li>
</ul>
<h2>Отступы YAML</h2>
<pre><code>- fill: "#email"
  with: $user</code></pre>
<h2>HTTP-примеры</h2>
<pre><code>node stubs/echo-server.mjs
natl run http_only.yaml</code></pre>
<h2>Всё ещё плохо?</h2>
<p>Issue на <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a> с строкой FAIL и ОС — я читаю.</p>
<p class="muted">— Арслан</p>`;

const ruAdapters = `
<h1>Адаптеры</h1>
<p>YAML — контракт. Adapter — как мы водим браузер (или обходимся HTTP).</p>
<p>По умолчанию я беру Playwright. Selenium и Cypress — когда так уже живёт команда.</p>
<table>
<thead><tr><th>engine</th><th>Пакет</th><th>Когда</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Дефолт, новые проекты, CI</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver / Grid</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Команды на Cypress (MVP)</td></tr>
<tr><td><code>http</code></td><td><code>@natl/core</code></td><td>Только API</td></tr>
</tbody>
</table>
<pre><code>natl run suite.yaml --engine selenium</code></pre>
<pre><code>- with: http
  steps:
    - get: $api_base/get
      save: ping</code></pre>`;

const ruArch = `
<h1>Архитектура</h1>
<p>Как я рисую это на доске:</p>
<ul>
  <li><strong>Вы пишете YAML</strong> — что тестировать</li>
  <li><strong>@natl/core</strong> — парсинг, шаги, HTTP</li>
  <li><strong>@natl/cli</strong> — команда <code>natl</code></li>
  <li><strong>adapters</strong> — клики и assert в реальном браузере</li>
</ul>
<pre><code>YAML → CLI → core → adapter-playwright
                ↘ http</code></pre>
<p>Поэтому смена engine для типичных сценариев — правка конфига. Крайности бывают — об этом честно в <a href="canon.html">каноне</a>.</p>`;

const ruCanon = `
<h1>Канон</h1>
<p>Не слоганы. Правила, которые я не ломаю, пока ращу NATL.</p>
<table>
<thead><tr><th>Верю</th><th>Значит</th></tr></thead>
<tbody>
<tr><td>Тесты должны быть короткими</td><td>Compact YAML + <code>do:</code></td></tr>
<tr><td>UI и API рядом</td><td>Один steps, <code>with: http</code></td></tr>
<tr><td>Стенды меняются чаще сценариев</td><td><code>--env</code>, vars, cases</td></tr>
<tr><td>Движки приходят и уходят</td><td>Портируемость через adapters</td></tr>
<tr><td>Честность важнее маркетинга</td><td>Большинство smoke переносится; хвост — escape hatch</td></tr>
<tr><td>Раннер ≠ TMS</td><td>В CLI нет дашборда</td></tr>
</tbody>
</table>
<p>Новый глагол? Вопрос один: <em>нужен ли он короткому fullstack smoke встроенным ~90%?</em></p>
<p class="muted">— Арслан</p>`;

/* ─── Chinese & Spanish: same structure, solid voice ─── */

const zhHome = `
<p class="muted">你好 — 我是 <strong>Arslan</strong>。我做 NATL，是因为每次技术栈一变，我就要重写同一批 smoke。</p>
<p>这是一个简短的开源 YAML 运行器，面向 <strong>Web UI 与 API</strong>。写一次紧凑场景；本地或 CI 执行；换引擎时改 <code>engine:</code>，而不是整套用例。</p>
<p>如果你是第一次来：先做教程。规范（Canon）等你看到绿色的 <code>PASS</code> 再读。</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>教程</h3><p>安装、登录场景、第一次 PASS。</p></a>
  <a class="card" href="syntax.html"><h3>语法</h3><p>我每天用的动词与例子。</p></a>
  <a class="card" href="troubleshooting.html"><h3>排错</h3><p>失败时先看这里。</p></a>
  <a class="card" href="adapters.html"><h3>适配器</h3><p>默认 Playwright。</p></a>
</div>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>`;

const zhGs = `
<h1>教程</h1>
<p>几分钟内：安装 NATL，跑我写好的 login，看到 <code>PASS</code>。</p>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
git clone https://github.com/arslan-ahmetjanov/natl.git
cd natl/examples
natl run login.yaml</code></pre>
<p>这是本地 HTML fixture，不是别人的生产站。然后故意改错 assert，再跑一次，读懂 <code>FAIL</code>。</p>
<pre><code>mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>
<p class="muted">— Arslan</p>`;

const zhSyntax = `
<h1>语法</h1>
<p>我希望 smoke 能放进一屏。</p>
<pre><code>steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Hello"</code></pre>
<table>
<thead><tr><th>步骤</th><th>含义</th></tr></thead>
<tbody>
<tr><td><code>goto</code></td><td>打开页面</td></tr>
<tr><td><code>fill</code> + <code>with</code></td><td>输入</td></tr>
<tr><td><code>click</code> / <code>tap</code></td><td>点击</td></tr>
<tr><td><code>assert</code></td><td>断言</td></tr>
<tr><td><code>do:</code></td><td>调用页面动作（POM）</td></tr>
</tbody>
</table>
<pre><code>- with: http
  steps:
    - get: $api_base/get
      save: ping</code></pre>`;

const zhTrouble = `
<h1>排错</h1>
<p><code>natl: command not found</code> → 检查全局 npm bin 是否在 PATH。</p>
<pre><code>npx playwright install chromium</code></pre>
<p>断言失败 → 检查选择器与 <code>artifacts/</code> 截图。</p>
<p>HTTP 示例 → 先运行 <code>node stubs/echo-server.mjs</code>。</p>
<p>仍有问题？在 <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub Issues</a> 留言，附上 FAIL 行。</p>
<p class="muted">— Arslan</p>`;

const zhAdapters = `
<h1>适配器</h1>
<p>YAML 是契约；适配器负责驱动浏览器。</p>
<table>
<thead><tr><th>engine</th><th>包</th><th>何时用</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>默认</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>已有 WebDriver</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Cypress 团队（MVP）</td></tr>
<tr><td><code>http</code></td><td><code>@natl/core</code></td><td>仅 API</td></tr>
</tbody>
</table>`;

const zhArch = `
<h1>架构</h1>
<p>YAML → CLI → core → adapter（或内置 http）。</p>
<p>典型流程换引擎只需改配置；边角情况我在<a href="canon.html">规范</a>里说得很直白。</p>`;

const zhCanon = `
<h1>规范</h1>
<p>短；UI+API 一起；用 config/env/cases 而不是满屏 <code>if</code>；用适配器保持可移植；诚实的能力边界；运行器不是 TMS。</p>
<p class="muted">— Arslan</p>`;

const esHome = `
<p class="muted">Hola — soy <strong>Arslan</strong>. Creé NATL porque estaba harto de reescribir los mismos smokes cada vez que cambiaba el stack.</p>
<p>Es un runner YAML open source, corto, para <strong>UI web y API</strong>. Un escenario compacto. Local o CI. Cambias <code>engine:</code>, no toda la suite.</p>
<p>Si es tu primera visita: empieza por el tutorial. El canon puede esperar al primer <code>PASS</code>.</p>
<div class="card-grid">
  <a class="card" href="getting-started.html"><h3>Tutorial</h3><p>Instalar, login, primer PASS.</p></a>
  <a class="card" href="syntax.html"><h3>Sintaxis</h3><p>Los verbos que uso cada día.</p></a>
  <a class="card" href="troubleshooting.html"><h3>Problemas</h3><p>Cuando falle — empieza aquí.</p></a>
  <a class="card" href="adapters.html"><h3>Adaptadores</h3><p>Playwright por defecto.</p></a>
</div>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version</code></pre>`;

const esGs = `
<h1>Tutorial</h1>
<p>En unos minutos: instalas NATL, corres el login que ya escribí, ves <code>PASS</code>.</p>
<pre><code>npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
git clone https://github.com/arslan-ahmetjanov/natl.git
cd natl/examples
natl run login.yaml</code></pre>
<p>Es un HTML local — no producción ajena. Luego rompe el assert a propósito y lee el <code>FAIL</code>.</p>
<pre><code>mkdir my-tests && cd my-tests
natl init
natl run tests/</code></pre>
<p class="muted">— Arslan</p>`;

const esSyntax = `
<h1>Sintaxis</h1>
<p>Quise que un smoke cupiera en una pantalla.</p>
<pre><code>steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Hello"</code></pre>
<table>
<thead><tr><th>Paso</th><th>Significado</th></tr></thead>
<tbody>
<tr><td><code>goto</code></td><td>Abrir página</td></tr>
<tr><td><code>fill</code> + <code>with</code></td><td>Escribir</td></tr>
<tr><td><code>click</code> / <code>tap</code></td><td>Clic</td></tr>
<tr><td><code>assert</code></td><td>Comprobar</td></tr>
<tr><td><code>do:</code></td><td>Acción POM</td></tr>
</tbody>
</table>
<pre><code>- with: http
  steps:
    - get: $api_base/get
      save: ping</code></pre>`;

const esTrouble = `
<h1>Problemas frecuentes</h1>
<p><code>natl: command not found</code> → revisa el PATH del npm global.</p>
<pre><code>npx playwright install chromium</code></pre>
<p>Assert fallido → selector y captura en <code>artifacts/</code>.</p>
<p>HTTP → primero <code>node stubs/echo-server.mjs</code>.</p>
<p>¿Sigues atascado? Abre un issue en <a href="https://github.com/arslan-ahmetjanov/natl/issues">GitHub</a>.</p>
<p class="muted">— Arslan</p>`;

const esAdapters = `
<h1>Adaptadores</h1>
<p>El YAML es el contrato; el adaptador conduce el navegador.</p>
<table>
<thead><tr><th>engine</th><th>Paquete</th><th>Cuándo</th></tr></thead>
<tbody>
<tr><td><code>playwright</code></td><td><code>@natl/adapter-playwright</code></td><td>Por defecto</td></tr>
<tr><td><code>selenium</code></td><td><code>@natl/adapter-selenium</code></td><td>WebDriver existente</td></tr>
<tr><td><code>cypress</code></td><td><code>@natl/adapter-cypress</code></td><td>Equipos Cypress (MVP)</td></tr>
<tr><td><code>http</code></td><td><code>@natl/core</code></td><td>Solo API</td></tr>
</tbody>
</table>`;

const esArch = `
<h1>Arquitectura</h1>
<p>YAML → CLI → core → adapter (o http integrado).</p>
<p>Los flujos típicos cambian de motor con config; los bordes raros los cuento en el <a href="canon.html">canon</a>.</p>`;

const esCanon = `
<h1>Canon</h1>
<p>Corto; UI+API juntos; config/env/cases en lugar de <code>if</code> por todas partes; portabilidad con adaptadores; techo honesto; runner ≠ TMS.</p>
<p class="muted">— Arslan</p>`;

const locales = {
  en: pack(
    "en",
    { title: "NATL", tagline: "Not Another Testing Language" },
    {
      home: "Home",
      gettingStarted: "Tutorial",
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
      "getting-started": { title: "Tutorial", html: enGs },
      syntax: { title: "Syntax", html: enSyntax },
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
      gettingStarted: "Туториал",
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
      "getting-started": { title: "Туториал", html: ruGs },
      syntax: { title: "Синтаксис", html: ruSyntax },
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
      gettingStarted: "教程",
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
      "getting-started": { title: "教程", html: zhGs },
      syntax: { title: "语法", html: zhSyntax },
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
      gettingStarted: "Tutorial",
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
      "getting-started": { title: "Tutorial", html: esGs },
      syntax: { title: "Sintaxis", html: esSyntax },
      troubleshooting: { title: "Problemas", html: esTrouble },
      adapters: { title: "Adaptadores", html: esAdapters },
      architecture: { title: "Arquitectura", html: esArch },
      canon: { title: "Canon", html: esCanon },
    },
  ),
};

for (const [name, data] of Object.entries(locales)) {
  writeFileSync(`docs/i18n/${name}.json`, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", name);
}
