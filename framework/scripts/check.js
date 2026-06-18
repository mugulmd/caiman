// One-shot correctness check for a session file.
//
//   bun framework/scripts/check.js [file]   (default: sessions/sandbox/live.js)
//
// Thin CLI over framework/server/validate.js — the same evaluate() the browser
// uses to play code, so a green check here means it will run there.

import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { validate } from '../server/validate.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Print a ✓/✗ line for a validation result.
function report(target, result) {
  const rel = basename(target);
  if (result.ok) {
    console.log(`${GREEN}✓${RESET} ${rel} ${DIM}— ok${RESET}`);
    return 0;
  }
  const { message, loc } = result.error;
  console.log(`${RED}✗${RESET} ${rel}${loc ? ` ${DIM}(${loc})${RESET}` : ''}`);
  console.log(`  ${RED}${message}${RESET}`);
  return 1;
}

if (import.meta.main) {
  const arg = process.argv[2] ?? 'sessions/sandbox/live.js';
  const target = resolve(process.cwd(), arg);
  if (!existsSync(target)) {
    console.error(`${RED}✗${RESET} no such file: ${arg}`);
    process.exit(2);
  }
  const result = await validate(readFileSync(target, 'utf8'));
  process.exit(report(target, result));
}
