// Demo: uses the custom "mysaw" synth registered in setup.js, plus default drums.
// Edit and save — it hot-swaps live.

stack(
  note("<c3 eb3 g3 bb3>").s("mysaw").lpf(800).room(0.3),
  s("bd hh sd hh").fast(4).lpf(1400),
);
