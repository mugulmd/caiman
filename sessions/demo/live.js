// Demo: uses the custom "mysaw" synth registered in setup.js, plus default drums.
// Edit and save — it hot-swaps live.

stack(
  note("<c3 eb3 g3 bb3>").s("mysaw").lpf(800).room(0.3),
  s("[bd bd] [hh hh hh] sd hh bd hh sd [hh bd]").lpf(1600).degradeBy(0.2),
);
