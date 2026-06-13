// Caiman prelude.
//
// Import everything you need for a pattern from here:
//
//     import { note, s, stack } from './strudel.js';
//
// This module does one essential thing the bare packages don't do on their
// own: it installs the mini-notation parser into the core controls, so that
// note('c [e g]*2') actually parses the string as mini-notation (and throws
// on malformed notation) instead of treating it as one opaque value.
//
// Types for everything re-exported here live in the generated `strudel.d.ts`
// sibling file (run `bun run gen-types` to regenerate). That's what powers
// autocomplete and docs-on-hover in your editor.

import { setStringParser } from '@strudel/core';
import { mini } from '@strudel/mini';

// Wire the mini-notation parser into core. Importing @strudel/mini is supposed
// to do this as a side effect, but that proved unreliable under bun/node, so we
// do it explicitly here.
setStringParser(mini);

export * from '@strudel/core';
export { mini } from '@strudel/mini';
