// Create a new session by copying the template.
//
//   bun run new <name>
//
// Produces sessions/<name>/ with live.js and session.json. Refuses to
// overwrite an existing session.

import { cpSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const name = process.argv[2];
if (!name) {
  console.error("usage: bun run new <name>");
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
  console.error(
    `invalid session name: ${name} (use letters, numbers, - and _)`,
  );
  process.exit(2);
}

const template = join(repoRoot, "sessions", "_template");
const dest = join(repoRoot, "sessions", name);

if (existsSync(dest)) {
  console.error(`session already exists: sessions/${name}`);
  process.exit(1);
}

cpSync(template, dest, { recursive: true });
console.log(`created sessions/${name}`);
console.log(`  edit  sessions/${name}/live.js`);
console.log(`  run   bun run session ${name}`);
