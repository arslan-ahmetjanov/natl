import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const en = JSON.parse(readFileSync("docs/i18n/en.json", "utf8"));

const NAV = `        <nav class="nav" aria-label="Docs">
          <a href="index.html" data-i18n="nav.home">Home</a>
          <a href="getting-started.html" data-i18n="nav.guide">Guide</a>
          <a href="troubleshooting.html" data-i18n="nav.troubleshooting">Troubleshooting</a>
          <a href="canon.html" data-i18n="nav.canon">Canon</a>
          <a href="architecture.html" data-i18n="nav.architecture">Architecture</a>
          <a href="adapters.html" data-i18n="nav.adapters">Adapters</a>
        </nav>`;

const map = {
  "index.html": "home",
  "getting-started.html": "guide",
  "troubleshooting.html": "troubleshooting",
  "canon.html": "canon",
  "architecture.html": "architecture",
  "adapters.html": "adapters",
};

const footer = `        <span data-i18n="footer.line">MIT License.</span>
        · <a href="https://github.com/arslan-ahmetjanov/natl">GitHub</a>
        · <a href="https://www.npmjs.com/package/@natl/cli">npm</a>`;

for (const [file, page] of Object.entries(map)) {
  const path = `docs/${file}`;
  let html = readFileSync(path, "utf8");
  if (!en.pages[page]) throw new Error("missing page " + page);

  html = html.replace(/<nav class="nav"[\s\S]*?<\/nav>/, NAV);
  // mark current page
  const href =
    file === "index.html"
      ? 'href="index.html"'
      : `href="${file}"`;
  html = html.replace(
    new RegExp(`(<a ${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*)(>)`),
    `$1 aria-current="page"$2`,
  );
  // remove duplicate aria-current
  html = html.replace(/aria-current="page" aria-current="page"/g, 'aria-current="page"');

  const body = en.pages[page].html.trim();
  if (file === "index.html") {
    html = html.replace(
      /<div class="content"[^>]*>[\s\S]*?<\/div>\s*<\/main>/,
      `<div class="content" data-page-content>\n${body}\n      </div>\n    </main>`,
    );
  } else {
    html = html.replace(
      /<article class="content"[^>]*>[\s\S]*?<\/article>/,
      `<article class="content" data-page-content>\n${body}\n      </article>`,
    );
  }

  html = html.replace(
    /<span data-i18n="footer\.line">[\s\S]*?<\/a>\s*·\s*<a href="https:\/\/www\.npmjs\.com\/package\/@natl\/cli">npm<\/a>/,
    footer,
  );

  // data-page attribute
  html = html.replace(/<body[^>]*>/, `<body data-page="${page}">`);

  writeFileSync(path, html);
  console.log("patched", file, body.length);
}

// syntax.html → redirect to guide (keep old links working)
const redirect = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=getting-started.html" />
    <link rel="canonical" href="getting-started.html" />
    <title>Guide · NATL</title>
    <script>location.replace("getting-started.html" + location.hash);</script>
  </head>
  <body>
    <p>Moved to the <a href="getting-started.html">guide</a>.</p>
  </body>
</html>
`;
writeFileSync("docs/syntax.html", redirect);
console.log("wrote syntax.html redirect");
