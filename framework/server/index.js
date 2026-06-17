// caiman session server.
//
//   bun run session <name>        (default: sandbox)
//
// Serves the web player (Vite) and runs socket.io on the SAME port. Watches the
// session's live.js / setup.js, validates on change, and pushes valid code to
// the browser, which hot-swaps it. A failed validation is logged and NOT pushed,
// so the last-good pattern keeps playing.

import { createServer as createViteServer } from 'vite';
import { Server as SocketServer } from 'socket.io';
import chokidar from 'chokidar';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, validateSetup } from './validate.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const name = process.argv[2] ?? 'sandbox';
const sessionDir = join(repoRoot, 'sessions', name);
const livePath = join(sessionDir, 'live.js');
const setupPath = join(sessionDir, 'setup.js');

const C = {
  red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m',
};

if (!existsSync(livePath)) {
  console.error(`${C.red}no session: sessions/${name}${C.reset}`);
  const sessionsDir = join(repoRoot, 'sessions');
  const existing = existsSync(sessionsDir)
    ? readdirSync(sessionsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
        .map((e) => e.name)
    : [];
  if (existing.length) console.error(`  sessions: ${existing.join(', ')}`);
  console.error(`  create one with: bun run new ${name}`);
  process.exit(2);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const stamp = () => new Date().toLocaleTimeString();

// The current snapshot sent to clients on (re)connect.
const session = { name, setup: read(setupPath), code: read(livePath) };

// --- Vite (serves the player) + socket.io (pushes code), one HTTP server -----
const vite = await createViteServer({ root: join(repoRoot, 'framework', 'web') });
await vite.listen();
const port = vite.config.server.port;

// websocket-only: HTTP long-polling doesn't survive sharing the port with Vite
// (the client never stays connected, reconnects ~1×/s, and each reconnect would
// re-send the snapshot and restart playback). Plain websocket is stable here.
const io = new SocketServer(vite.httpServer, { path: '/caiman.io', transports: ['websocket'] });
io.on('connection', (socket) => {
  socket.emit('session', session);
  // Errors that only surface once the browser runs the code (e.g. a sound name
  // that isn't loaded) come back here and print in your terminal.
  socket.on('runtime-error', ({ phase, message }) => {
    console.log(`${C.red}✗ browser:${phase}${C.reset} ${message}`);
  });
});

// --- watch + validate + push -------------------------------------------------
async function onLiveChange() {
  const source = read(livePath);
  const result = await validate(source);
  if (result.ok) {
    session.code = source;
    io.emit('code', { source, ts: Date.now() });
    console.log(`${C.green}✓${C.reset} ${C.dim}${stamp()}${C.reset} live.js → pushed`);
  } else {
    const loc = result.error.loc ? ` ${C.dim}(${result.error.loc})${C.reset}` : '';
    console.log(`${C.red}✗${C.reset} ${C.dim}${stamp()}${C.reset} live.js${loc} ${result.error.message}`);
    console.log(`  ${C.dim}not pushed — last good pattern keeps playing${C.reset}`);
    io.emit('validation-error', { phase: 'check', message: result.error.message, loc: result.error.loc });
  }
}

function onSetupChange() {
  const source = read(setupPath);
  const result = validateSetup(source);
  if (result.ok) {
    session.setup = source;
    io.emit('setup', { source, ts: Date.now() });
    console.log(`${C.green}✓${C.reset} ${C.dim}${stamp()}${C.reset} setup.js → pushed`);
  } else {
    console.log(`${C.red}✗${C.reset} ${C.dim}${stamp()}${C.reset} setup.js ${result.error.message}`);
    io.emit('validation-error', { phase: 'setup', message: result.error.message, loc: result.error.loc });
  }
}

chokidar
  .watch([livePath, setupPath], { ignoreInitial: true })
  .on('change', (p) => (resolve(p) === setupPath ? onSetupChange() : onLiveChange()));

// --- startup banner ----------------------------------------------------------
const initial = await validate(session.code);
console.log(`\n${C.cyan}caiman${C.reset} · session ${C.cyan}${name}${C.reset}`);
console.log(`  player:  ${C.cyan}http://localhost:${port}${C.reset}`);
console.log(`  editing: sessions/${name}/live.js`);
console.log(
  initial.ok
    ? `  ${C.green}✓ live.js ok${C.reset}\n`
    : `  ${C.red}✗ live.js: ${initial.error.message}${C.reset}\n`,
);
