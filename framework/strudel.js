// Caiman prelude.
//
// You don't import this directly — the checker loads it and copies every export
// onto globalThis, so pattern files can call note(), stack(), ... with no import
// (just like the Strudel REPL). It's also where the runtime API surface comes
// from for `bun run gen-types`.
//
// It does one essential thing the bare packages don't do on their own: it
// installs the mini-notation parser into the core controls, so that
// note('c [e g]*2') actually parses the string as mini-notation (and throws on
// malformed notation) instead of treating it as one opaque value.

import { setStringParser } from '@strudel/core';
import { mini } from '@strudel/mini';

// Wire the mini-notation parser into core. Importing @strudel/mini is supposed
// to do this as a side effect, but that proved unreliable under bun/node, so we
// do it explicitly here.
setStringParser(mini);

export * from '@strudel/core';
// `m` is what the transpiler rewrites double-quoted strings into, so it must be
// a global for evaluated/transpiled code to run. `mini` is its long name.
export { mini, m } from '@strudel/mini';
