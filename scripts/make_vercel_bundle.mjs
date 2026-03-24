import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release", "vercel-upload-package");

const includeFiles = [
  "package.json",
  "package-lock.json",
  "vercel.json",
  "middleware.js",
  "README.md",
  "VERCEL_ENV_CHECKLIST.md",
  ".gitignore",
  ".env.vercel.example",
  ".env.vercel.deepseek.example",
  ".env.vercel.kimi.example",
  ".env.vercel.siliconflow.example",
];

const includeDirs = [
  "api",
  "public",
  "server",
];

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

for (const file of includeFiles) {
  copyPath(path.join(root, file), path.join(releaseDir, file));
}

for (const dir of includeDirs) {
  copyPath(path.join(root, dir), path.join(releaseDir, dir));
}

console.log(`Prepared bundle folder at ${releaseDir}`);

function copyPath(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    const name = path.basename(source);
    if (["node_modules", "__pycache__", ".vercel", ".git", "release"].includes(name)) {
      return;
    }
    fs.mkdirSync(target, { recursive: true });
    for (const item of fs.readdirSync(source)) {
      copyPath(path.join(source, item), path.join(target, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
