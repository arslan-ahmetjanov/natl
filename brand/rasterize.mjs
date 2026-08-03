import { chromium } from "../adapter-playwright/node_modules/playwright/index.mjs";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const brand = path.dirname(fileURLToPath(import.meta.url));

const jobs = [
  { svg: "natl-icon-steps.svg", out: "natl-icon-512.png", w: 512, h: 512 },
  { svg: "natl-icon-steps.svg", out: "natl-icon-128.png", w: 128, h: 128 },
  { svg: "natl-lockup.svg", out: "natl-lockup-exact.png", w: 960, h: 240 },
  { svg: "natl-wordmark.svg", out: "natl-wordmark-exact.png", w: 600, h: 168 },
  { svg: "natl-wordmark-dark.svg", out: "natl-wordmark-dark.png", w: 600, h: 168 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const job of jobs) {
  const svg = readFileSync(path.join(brand, job.svg), "utf8");
  const sized = svg.replace(
    "<svg",
    `<svg width="${job.w}" height="${job.h}"`,
  );
  await page.setViewportSize({ width: job.w, height: job.h });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
    { waitUntil: "load" },
  );
  const el = await page.$("svg");
  await el.screenshot({
    path: path.join(brand, job.out),
    omitBackground: true,
  });
  console.log("wrote", job.out);
}

await browser.close();
