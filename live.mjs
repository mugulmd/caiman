// Your live pattern. Edit freely, then save — the watcher checks it.
//
//   bun run watch        # in a terminal: re-checks this file on every save
//   bun run check        # one-shot check
//
// Plain explicit JS dialect: import what you use, single-quoted strings are
// parsed as mini-notation by the controls (note, s, n, ...), and you stack
// patterns with stack(...) rather than the REPL's `$:` shorthand.

import { stack, note, s, sequence } from "./strudel.js";

export default stack(note("c3 [eb3 g3]*2 <bb3 a3>"), s("bd hh sd hh"));
