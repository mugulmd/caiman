// Your live pattern — just write Strudel, no imports needed.
//
//   bun run watch        # in a terminal: re-checks this file on every save
//   bun run check        # one-shot check
//
// All Strudel functions (note, s, n, stack, ...) are available as globals, the
// same way they are in the Strudel REPL. Strings inside controls are parsed as
// mini-notation. The last expression is your pattern.

stack(note("c3 [eb3 g3]*2 <bb3 a3>"), s("bd hh sd hh"));
