import { readFileSync, writeFileSync } from "node:fs";

const en = JSON.parse(readFileSync("docs/i18n/en.json", "utf8"));
const map = {
  "index.html": "home",
  "getting-started.html": "getting-started",
  "syntax.html": "syntax",
  "troubleshooting.html": "troubleshooting",
  "canon.html": "canon",
  "architecture.html": "architecture",
  "adapters.html": "adapters",
};

for (const [file, page] of Object.entries(map)) {
  const path = `docs/${file}`;
  let html = readFileSync(path, "utf8");
  if (!en.pages[page]) throw new Error("missing page " + page);
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

  writeFileSync(path, html);
  console.log("patched", file, body.length);
}
