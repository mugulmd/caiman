// Session setup — runs once in the browser on connect.
//
// Demonstrates a custom synth. It only produces the raw tone; gain, filters,
// reverb, etc. from the pattern (.lpf(), .room(), …) are applied for you by the
// engine. samples()/registerSound()/getAudioContext() are globals here.

// A detuned sawtooth, playable as s("mysaw").
registerSound(
  'mysaw',
  (time, value, onended) => {
    const ctx = getAudioContext();
    // Derive Hz from the value — works whether the pattern used note(...) or
    // freq(...). (Reading value.freq directly is undefined for note(...).)
    const frequency = getFrequencyFromValue(value);
    const duration = value.duration ?? 0.25;

    const o1 = new OscillatorNode(ctx, { type: 'sawtooth', frequency });
    const o2 = new OscillatorNode(ctx, { type: 'sawtooth', frequency: frequency * 1.007 }); // detune
    const g = new GainNode(ctx, { gain: 0 });
    o1.connect(g);
    o2.connect(g);

    // Short attack/release envelope so notes start and end without clicks.
    const attack = 0.01;
    const release = 0.1;
    const holdEnd = time + duration;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.2, time + attack);
    g.gain.setValueAtTime(0.2, holdEnd);
    g.gain.linearRampToValueAtTime(0, holdEnd + release);

    o1.start(time);
    o2.start(time);

    // CRUCIAL: schedule the voice to end. Without a stop, every triggered
    // oscillator runs forever — they pile up and ignore pause.
    const end = holdEnd + release + 0.01;
    o1.stop(end);
    o2.stop(end);

    o1.onended = () => {
      o1.disconnect();
      o2.disconnect();
      g.disconnect();
      onended();
    };

    // Early stop, used when you hush / swap the pattern.
    return {
      node: g,
      stop: (t) => {
        try {
          o1.stop(t);
          o2.stop(t);
        } catch {
          // already stopped
        }
      },
    };
  },
  { type: 'synth' },
);

// Custom samples example (needs your own files — `npx @strudel/sampler` serves a
// folder). Uncomment and point at your kit:
//
//   await samples({ clap: 'clap.wav', rim: 'rim.wav' }, 'http://localhost:5432/');
