// caiman web player — P2 (no socket yet).
//
// Boots a single Strudel runtime and plays a hardcoded pattern, then hot-swaps
// to another, to prove the scheduler.setPattern path. It uses repl().evaluate,
// which runs the SAME core evaluate(code, transpiler) the server validates with
// — so a pattern that passes `bun run check` will run here.

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

const els = {
  play: document.getElementById('play'),
  swap: document.getElementById('swap'),
  stop: document.getElementById('stop'),
  code: document.getElementById('code'),
  status: document.getElementById('status'),
};

const setStatus = (msg, isError = false) => {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
};

// Two hardcoded patterns to demonstrate playing + hot-swapping. P3 replaces this
// with whatever the server pushes over the socket.
const PATTERNS = {
  a: `stack(
  note("c3 [eb3 g3]*2 <bb3 a3>").s("sawtooth").lpf(700),
  s("bd hh sd hh"),
)`,
  b: `stack(
  s("bd*2 [~ sd] bd sd"),
  s("hh*8").gain(0.6),
  note("c2 <eb2 g2>").s("square").lpf(500).slow(2),
)`,
};

let strudelRepl;

async function boot() {
  // Expose the whole Strudel API as globals so evaluated code (and the
  // transpiler's m() calls) resolve. This is the browser-side equivalent of the
  // server's prelude injection.
  await evalScope(
    import('@strudel/core'),
    import('@strudel/mini'),
    import('@strudel/webaudio'),
  );

  await registerSynthSounds(); // sine / sawtooth / square / triangle / ...
  setStatus('loading default samples (bd, sd, hh, …)…');
  await samples('github:tidalcycles/dirt-samples'); // default drum kit

  strudelRepl = repl({
    defaultOutput: webaudioOutput,
    getTime: () => getAudioContextCurrentTime(),
    transpiler,
    onEvalError: (err) => setStatus(`eval error: ${err.message}`, true),
  });

  initAudioOnFirstClick(); // unlocks the AudioContext on the first user gesture

  els.code.textContent = PATTERNS.a;
  els.play.disabled = false;
  els.swap.disabled = false;
  els.stop.disabled = false;
  setStatus('ready — click ▶ play');
}

async function play(code) {
  els.code.textContent = code;
  try {
    await initAudio(); // safe to call repeatedly; resumes the context
    await strudelRepl.evaluate(code); // transpile → evaluate → setPattern → start
    setStatus('playing');
  } catch (err) {
    setStatus(`error: ${err.message}`, true);
  }
}

els.play.addEventListener('click', () => play(PATTERNS.a));
els.swap.addEventListener('click', () => play(PATTERNS.b));
els.stop.addEventListener('click', () => {
  strudelRepl?.stop();
  setStatus('stopped');
});

boot().catch((err) => setStatus(`boot failed: ${err.message}`, true));
