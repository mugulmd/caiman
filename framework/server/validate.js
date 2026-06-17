// Canonical correctness check, built on Strudel's evaluate().
//
// This is the SAME evaluation the browser uses to play code, so check-time and
// run-time semantics can't drift. We evaluate the source *string* (transpile →
// eval), which:
//   - catches JS syntax errors (acorn, during transpile)
//   - catches mini-notation errors (the transpiler rewrites "…" into m(), which
//     parses eagerly when called)
//   - catches reference errors (undefined functions)
// then queries cycle 0 to surface immediate query-time errors.
//
// Because we evaluate a string (not import a file path), there's no module
// source cache to fight: one long-lived process can validate any number of
// edits. No subprocess, no audio, no browser.

// Load the prelude (which injects the Strudel API as globals) and the
// transpiler, silencing the libraries' load-time console chatter.
async function load() {
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = () => {};
  try {
    const strudel = await import('../strudel.js');
    const { transpiler } = await import('@strudel/transpiler');
    for (const [key, value] of Object.entries(strudel)) {
      try {
        globalThis[key] = value;
      } catch {
        // skip names that collide with read-only globals
      }
    }
    return { evaluate: strudel.evaluate, transpiler };
  } finally {
    [console.log, console.warn, console.error] = saved;
  }
}

const { evaluate, transpiler } = await load();

// Pull a "line:col" out of the error MESSAGE only — acorn formats syntax errors
// as "Unexpected token (line:col)" against the real source. We deliberately
// ignore err.stack: for mini-notation and reference errors it points into
// library/eval internals, and a wrong line number is worse than none. Those
// errors carry their own positional hints in the message text instead.
function locate(err) {
  const m = (err?.message ?? '').match(/\((\d+):(\d+)\)/);
  return m ? `${m[1]}:${m[2]}` : null;
}

// Validate a source string. Returns { ok: true } or { ok: false, error }.
export async function validate(source) {
  try {
    const { pattern } = await evaluate(source, transpiler);
    // Surface immediate query-time errors (the browser queries continuously).
    if (pattern && typeof pattern.queryArc === 'function') {
      pattern.queryArc(0, 1);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: {
        message: (err?.message ?? String(err)).split('\n')[0],
        loc: locate(err),
      },
    };
  }
}
