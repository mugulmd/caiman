// caiman web player — P3.
//
// A dumb player: it knows nothing about sessions. It connects to the server over
// socket.io and plays whatever code arrives, hot-swapping on every push. The
// same core evaluate(code, transpiler) the server validates with runs here (via
// repl().evaluate), so check==run.

import { io } from 'socket.io-client';
import { repl, evalScope } from '@strudel/core';
import { transpiler } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  initAudio,
  initAudioOnFirstClick,
  registerSynthSounds,
  samples,
  webaudioOutput,
} from '@strudel/webaudio';

// Runs setup.js as plain side-effect JS (no transpiler — its strings are URLs /
// sample names, not mini-notation). Mirrors the server's validateSetup parser.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

const els = {
  start: document.getElementById('start'),
  stop: document.getElementById('stop'),
  code: document.getElementById('code'),
  status: document.getElementById('status'),
};
const setStatus = (msg, isError = false) => {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
};

let strudelRepl;
let socket;
let started = false; // becomes true after the user clicks ▶ (unlocks audio)
const pending = { setup: null, code: null };
// What's currently live, so we never re-evaluate identical source. This keeps
// reconnects (e.g. server restart) from restarting playback from cycle 0.
const playing = { setup: null, code: null };

async function boot() {
  // Expose the whole Strudel API as globals so evaluated code (and the
  // transpiler's m() calls) resolve.
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/webaudio'));
  await registerSynthSounds();
  setStatus('loading default samples (bd, sd, hh, …)…');
  await samples('github:tidalcycles/dirt-samples');

  strudelRepl = repl({
    defaultOutput: webaudioOutput,
    getTime: () => getAudioContextCurrentTime(),
    transpiler,
    onEvalError: (err) => reportRuntime('eval', err),
  });
  initAudioOnFirstClick();

  connect();
  els.start.disabled = false;
  els.stop.disabled = false;
}

function connect() {
  socket = io({ path: '/caiman.io', transports: ['websocket'] });
  socket.on('connect', () => setStatus(started ? 'playing' : 'connected — click ▶ start'));
  socket.on('disconnect', () => setStatus('server offline — will reconnect…', true));

  // Full snapshot on (re)connect.
  socket.on('session', ({ name, setup, code }) => {
    document.title = `caiman — ${name}`;
    pending.setup = setup;
    pending.code = code;
    els.code.textContent = code ?? '';
    if (started) applyAll();
  });
  // live.js changed and passed validation → hot-swap.
  socket.on('code', ({ source }) => {
    pending.code = source;
    els.code.textContent = source;
    if (started) play(source);
  });
  // setup.js changed → re-run registration.
  socket.on('setup', ({ source }) => {
    pending.setup = source;
    if (started) runSetup(source);
  });
}

async function runSetup(source) {
  if (!source?.trim() || source === playing.setup) return;
  try {
    await new AsyncFunction(source)();
    playing.setup = source;
  } catch (err) {
    reportRuntime('setup', err);
  }
}

async function play(code) {
  if (!code?.trim() || code === playing.code) return; // skip identical → no glitch
  try {
    await strudelRepl.evaluate(code); // transpile → evaluate → setPattern → start
    playing.code = code;
    setStatus('playing');
  } catch (err) {
    reportRuntime('eval', err);
  }
}

async function applyAll() {
  await runSetup(pending.setup);
  await play(pending.code);
}

function reportRuntime(phase, err) {
  setStatus(`${phase} error: ${err.message}`, true);
  socket?.emit('runtime-error', { phase, message: err.message });
}

els.start.addEventListener('click', async () => {
  await initAudio(); // unlock/resume the AudioContext (needs this user gesture)
  started = true;
  els.start.textContent = '▶ live';
  await applyAll();
});
els.stop.addEventListener('click', () => {
  strudelRepl?.stop();
  setStatus('stopped — ▶ to resume');
});

boot().catch((err) => setStatus(`boot failed: ${err.message}`, true));
