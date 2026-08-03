import { copyFileSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "brand");
const targets = [
  "core",
  "cli",
  "adapter-playwright",
  "adapter-selenium",
  "adapter-cypress",
  "examples",
];

const files = readdirSync(src).filter(
  (f) =>
    (f.endsWith(".png") || f.endsWith(".svg")) &&
    !f.includes(".hero.") &&
    !f.includes("-exact."),
);

for (const t of targets) {
  const dest = path.join(root, t, "brand");
  mkdirSync(dest, { recursive: true });
  for (const f of files) {
    copyFileSync(path.join(src, f), path.join(dest, f));
  }
  copyFileSync(path.join(src, "PACKAGE_README.md"), path.join(dest, "README.md"));
  console.log(`synced ${t}/brand (${files.length} assets)`);
}
