// caiman web player.
//
// A dumb player: it connects to the server over socket.io and plays whatever
// code arrives, hot-swapping on every push. It uses repl().evaluate, which runs
// the SAME core evaluate(code, transpiler) the server validates with, so a
// pattern that passes the server's check will run here.

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
  overlay: document.getElementById('overlay'),
  start: document.getElementById('start'),
  session: document.getElementById('session'),
  conn: document.getElementById('conn'),
  banner: document.getElementById('banner'),
  code: document.getElementById('code'),
  toggle: document.getElementById('toggle'),
  status: document.getElementById('status'),
};

const setStatus = (msg) => (els.status.textContent = msg);
const setConn = (state) => {
  els.conn.className = state;
  els.conn.textContent = { live: '● live', offline: '○ offline', connecting: '… connecting' }[state];
};
const showBanner = (phase, message, loc) => {
  els.banner.textContent = `${phase}${loc ? ` (${loc})` : ''}: ${message}`;
  els.banner.hidden = false;
};
const clearBanner = () => {
  els.banner.hidden = true;
  els.banner.textContent = '';
};

let strudelRepl;
let socket;
let started = false; // true after the user clicks ▶ start (unlocks audio)
let isPlaying = false; // scheduler running? kept in sync by repl's onToggle
const pending = { setup: null, code: null };
// What's currently live, so we never re-evaluate identical source (keeps
// reconnects from restarting playback from cycle 0).
const playing = { setup: null, code: null };

async function boot() {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/webaudio'));
  await registerSynthSounds();
  els.start.textContent = 'loading samples…';
  await samples('github:tidalcycles/dirt-samples');

  strudelRepl = repl({
    defaultOutput: webaudioOutput,
    getTime: () => getAudioContextCurrentTime(),
    transpiler,
    onEvalError: (err) => reportRuntime('eval', err),
    onToggle: (isOn) => {
      isPlaying = isOn;
      els.toggle.textContent = isOn ? '⏸ pause' : '▶ resume';
      setStatus(isOn ? 'playing' : 'paused');
    },
  });
  initAudioOnFirstClick();

  connect();
  els.start.disabled = false;
  els.start.textContent = '▶ start';
}

function connect() {
  socket = io({ path: '/caiman.io', transports: ['websocket'] });
  setConn('connecting');
  socket.on('connect', () => setConn('live'));
  socket.on('disconnect', () => setConn('offline'));

  // Full snapshot on (re)connect.
  socket.on('session', ({ name, setup, code }) => {
    els.session.textContent = `caiman · ${name}`;
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
    clearBanner();
    if (started) play(source);
  });
  // setup.js changed → re-run registration.
  socket.on('setup', ({ source }) => {
    pending.setup = source;
    clearBanner();
    if (started) runSetup(source);
  });
  // Server-side validation failed → show why; the last-good pattern keeps playing.
  socket.on('validation-error', ({ phase, message, loc }) => showBanner(phase, message, loc));
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
    clearBanner();
  } catch (err) {
    reportRuntime('eval', err);
  }
}

async function applyAll() {
  await runSetup(pending.setup);
  await play(pending.code);
}

function reportRuntime(phase, err) {
  showBanner(phase, err.message);
  socket?.emit('runtime-error', { phase, message: err.message });
}

els.start.addEventListener('click', async () => {
  await initAudio(); // unlock/resume the AudioContext (needs this user gesture)
  started = true;
  els.overlay.hidden = true;
  els.toggle.disabled = false;
  await applyAll();
});
// The scheduler has no toggle(); drive it with explicit stop()/start().
els.toggle.addEventListener('click', () => {
  if (!strudelRepl) return;
  if (isPlaying) strudelRepl.stop();
  else strudelRepl.start();
});

boot().catch((err) => {
  els.start.textContent = `boot failed: ${err.message}`;
});
