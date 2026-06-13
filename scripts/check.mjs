// Evaluate-on-save correctness check.
//
// Imports a pattern file and reports any error. Because Strudel parses
// mini-notation eagerly when a control like note('c [e') is called, simply
// loading the module surfaces BOTH JavaScript syntax errors AND mini-notation
// parse errors — no audio, no browser, no transpiler needed.
//
// Usage:  bun scripts/check.mjs [file.mjs]   (default: live.mjs)
//
// For the check to see your patterns, the file must evaluate them at module
// top level, e.g.  export default stack(note('c e g'), s('bd hh'))

import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Load the prelude once, silencing the library's load-time chatter.
async function ensurePrelude() {
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  console.log = console.warn = console.error = () => {};
  try {
    await import(pathToFileURL(join(root, 'strudel.js')).href);
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
}

// Pull a "file:line:col" location for the user's file out of an error stack.
function locateInFile(err, absPath) {
  const name = basename(absPath);
  const stack = err?.stack ?? '';
  for (const line of stack.split('\n')) {
    const m = line.match(new RegExp(`${name.replace(/[.]/g, '\\.')}:(\\d+):(\\d+)`));
    if (m) return `${name}:${m[1]}:${m[2]}`;
  }
  return null;
}

// Note: a single process can only check a given file once — bun caches module
// source by path, so re-importing (even with a cache-busting query) re-runs the
// stale source. The watcher therefore spawns a fresh process per save.
export async function checkFile(absPath) {
  await ensurePrelude();
  try {
    await import(pathToFileURL(absPath).href);
    return { ok: true };
  } catch (err) {
    return { ok: false, err };
  }
}

function report(target, result) {
  const rel = basename(target);
  if (result.ok) {
    console.log(`${GREEN}✓${RESET} ${rel} ${DIM}— ok${RESET}`);
    return 0;
  }
  const { err } = result;
  const loc = locateInFile(err, target);
  const msg = (err?.message ?? String(err)).split('\n')[0];
  console.log(`${RED}✗${RESET} ${rel}${loc ? ` ${DIM}(${loc})${RESET}` : ''}`);
  console.log(`  ${RED}${msg}${RESET}`);
  return 1;
}

// Run as a script (not when imported by watch.mjs).
if (import.meta.main) {
  const arg = process.argv[2] ?? 'live.mjs';
  const target = resolve(process.cwd(), arg);
  if (!existsSync(target)) {
    console.error(`${RED}✗${RESET} no such file: ${arg}`);
    process.exit(2);
  }
  const result = await checkFile(target);
  process.exit(report(target, result));
}

export { report };
