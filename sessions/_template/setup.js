// Session setup — custom samples and synths for THIS session.
//
// This runs once in the browser when the page connects (it needs the Web Audio
// context, so unlike live.js it can't run in the Node checker — it's only
// syntax-checked). Like live.js, everything here is a global; no imports.
//
// Load your own samples:
//
//   samples({
//     bd: 'bd/kick.wav',
//     hh: ['hh/closed.wav', 'hh/open.wav'],   // s("hh:1") picks the 2nd
//   }, 'http://localhost:5432/');               // npx @strudel/sampler serves a folder
//
// Register a custom synth (returns the raw tone; gain/filters/fx are applied
// for you by the engine):
//
//   registerSound('mysaw', (time, value, onended) => {
//     const { freq } = value;
//     const ctx = getAudioContext();
//     const o = new OscillatorNode(ctx, { type: 'sawtooth', frequency: Number(freq) });
//     o.start(time);
//     const g = new GainNode(ctx, { gain: 0.3 });
//     const node = o.connect(g);
//     o.addEventListener('ended', () => { o.disconnect(); g.disconnect(); onended(); });
//     return { node, stop: (t) => o.stop(t) };
//   }, { type: 'synth' });

// (default samples bd/sd/hh are loaded by the framework — see ARCHITECTURE.md)
