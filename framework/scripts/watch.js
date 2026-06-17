// Re-runs the correctness check whenever a session file changes.
//
//   bun framework/scripts/watch.js [file]   (default: sessions/sandbox/live.js)
//
// Keep this running in a terminal pane while you edit. On every save you get a
// green ✓ or a red ✗ with the error and location — the closest thing to "live
// type checking" for Strudel, and it checks the mini-notation too.
//
// Validation runs in-process: validate() evaluates the source *string*, so there
// is no module cache to defeat (the reason the old version spawned a subprocess
// per save). This same validator is what the server will use in P3.

import { basename, dirname, resolve } from 'node:path';
import { existsSync, readFileSync, watch } from 'node:fs';
import { validate } from '../server/validate.js';
import { report } from './check.js';

const arg = process.argv[2] ?? 'sessions/sandbox/live.js';
const target = resolve(process.cwd(), arg);

if (!existsSync(target)) {
  console.error(`no such file: ${arg}`);
  process.exit(2);
}

const dir = dirname(target);
const name = basename(target);

let timer = null;
let running = false;
let pending = false;

async function run() {
  // Coalesce saves that land mid-check; always finish on the latest content.
  if (running) {
    pending = true;
    return;
  }
  running = true;
  do {
    pending = false;
    report(target, await validate(readFileSync(target, 'utf8')));
  } while (pending);
  running = false;
}

// Editors often save via atomic rename, which breaks watching the file
// directly — so watch the directory and filter by filename.
watch(dir, (_event, changed) => {
  if (changed !== name) return;
  clearTimeout(timer);
  timer = setTimeout(run, 50); // debounce rapid save events
});

console.log(`watching ${name} — save to re-check (ctrl-c to stop)`);
await run();
