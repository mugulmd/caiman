// Re-runs the evaluate-on-save check whenever the pattern file changes.
//
// Usage:  bun framework/scripts/watch.js [file]   (default: sessions/sandbox/live.js)
//
// Keep this running in a terminal pane while you edit. On every save you get a
// green ✓ or a red ✗ with the error and location. This is the closest thing to
// "live type checking" for Strudel — and it checks the mini-notation too.
//
// Each check runs in a fresh `bun check.mjs` subprocess. That's deliberate: a
// long-lived process caches module source by path, so it would keep re-checking
// stale code. A new process per save guarantees the current file is read. A
// check takes ~40ms, so this is imperceptible.

import { dirname, basename, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, watch } from 'node:fs';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const checkScript = join(__dirname, 'check.js');

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

function runOnce() {
  return new Promise((res) => {
    const child = spawn(process.execPath, [checkScript, target], { stdio: 'inherit' });
    child.on('close', () => res());
    child.on('error', () => res());
  });
}

async function run() {
  // Coalesce saves that land mid-check; always finish on the latest content.
  if (running) {
    pending = true;
    return;
  }
  running = true;
  do {
    pending = false;
    await runOnce();
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
