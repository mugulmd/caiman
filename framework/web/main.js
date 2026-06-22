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
const pending = { library: [], code: null };
// What's currently live, so we never re-evaluate identical source (keeps
// reconnects from restarting playback / re-registering for nothing).
const playing = { library: null, code: null };

async function boot() {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/webaudio'));
  await registerSynthSounds();
  els.start.textContent = 'loading samples…';
  // Strudel's default sound set (dough-samples): drum machines (with .bank()),
  // VCSL instruments, piano, Emu SP12, Dirt-Samples, mridangam. Maps register
  // names immediately; the audio files are fetched lazily on first play.
  const ds = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/';
  await Promise.all([
    samples(`${ds}tidal-drum-machines.json`),
    samples(`${ds}piano.json`),
    samples(`${ds}Dirt-Samples.json`),
    samples(`${ds}EmuSP12.json`),
    samples(`${ds}vcsl.json`),
    samples(`${ds}mridangam.json`),
  ]);

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

  // Transport functions (setcps/setcpm/hush) are created inside repl(), not
  // exported as modules — so evalScope never injected them. Expose them as
  // globals here so pattern code can call them. (setcpm = cycles/min → cps/60.)
  Object.assign(globalThis, {
    setcps: (cps) => strudelRepl.setCps(cps),
    setCps: (cps) => strudelRepl.setCps(cps),
    setcpm: (cpm) => strudelRepl.setCps(cpm / 60),
    setCpm: (cpm) => strudelRepl.setCps(cpm / 60),
    hush: () => strudelRepl.stop(),
  });

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
  socket.on('session', ({ name, library, code }) => {
    els.session.textContent = `caiman · ${name}`;
    document.title = `caiman — ${name}`;
    pending.library = library ?? [];
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
  // a library/**/*.js file changed → re-register synths/samples live.
  socket.on('library', ({ files }) => {
    pending.library = files ?? [];
    clearBanner();
    if (started) runLibrary(pending.library);
  });
  // Server-side validation failed → show why; the last-good pattern keeps playing.
  socket.on('validation-error', ({ phase, message, loc }) => showBanner(phase, message, loc));
}

async function runLibrary(files) {
  if (!files?.length) return;
  const key = JSON.stringify(files);
  if (key === playing.library) return; // identical → already registered
  for (const { file, source } of files) {
    if (!source?.trim()) continue;
    try {
      await new AsyncFunction(source)();
    } catch (err) {
      reportRuntime(`library/${file}`, err);
    }
  }
  playing.library = key;
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
  await runLibrary(pending.library);
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
