# caiman

Live-code [Strudel](https://strudel.cc) from a local file in your own editor,
with autocomplete, docs-on-hover, and an evaluate-on-save correctness check —
no in-browser editor required.

This repo is **tooling only**: writing patterns, getting editor smarts, and
checking that they're valid. Actually producing audio (a browser page running
`@strudel/web`) is a separate, later step.

## Quick start

```bash
bun install
bun run watch      # re-checks live.mjs on every save (keep open in a pane)
```

Edit `live.mjs`. On save you get a green ✓ or a red ✗ with the error and
location. One-shot check: `bun run check [file.mjs]`.

## How to write patterns

Plain explicit JavaScript — import what you use from the local prelude
`./strudel.js`, and evaluate your pattern at the top level (so the checker
sees it):

```js
import { stack, note, s } from './strudel.js';

export default stack(
  note('c3 [eb3 g3]*2 <bb3 a3>'),
  s('bd hh sd hh'),
);
```

Single-quoted strings inside controls (`note`, `s`, `n`, …) are parsed as
mini-notation. We use plain JS (`stack(...)`, explicit calls) rather than the
REPL's `"..."`-as-pattern magic and `$:` track syntax, because that keeps the
file valid JavaScript — which is what makes standard editor tooling (and AI
edits) work without a transpiler.

## How it works

Three pieces, each deliberately simple:

- **`strudel.js`** — a prelude that re-exports `@strudel/core` and, crucially,
  installs the mini-notation parser (`setStringParser(mini)`). Import from here,
  not the packages directly, so string patterns actually parse.

- **`strudel.d.ts`** — generated, permissive type stubs that power autocomplete
  and hover. Names come from runtime introspection of Strudel's registry;
  hover docs are parsed from the JSDoc in the packages' shipped source. Every
  function is typed `(...args: any[]) => Pattern` so chains complete — the types
  are **not** meant to be accurate. Regenerate after upgrading Strudel:
  `bun run gen-types`. The editor associates it with `strudel.js` automatically
  (same basename), so no extra config is needed.

- **`scripts/check.mjs` + `scripts/watch.mjs`** — the correctness check. It just
  imports your file in Node/bun. Because Strudel parses mini-notation eagerly,
  loading the module surfaces **both** JS errors and mini-notation errors — with
  no browser, audio, or transpiler. The watcher runs each check in a fresh
  subprocess (~40ms) because a long-lived process caches module source by path.

## Notes

- **Why the patch?** `@strudel/core` depends on `@kabelsalat/web`, which ships no
  `exports` field, so Node/bun resolve its CJS entry and the named import fails.
  `patches/@kabelsalat%2Fweb@0.4.1.patch` (via `bun patch`) adds the `exports`
  field; it re-applies automatically on `bun install`. If you bump Strudel and
  the kabelsalat version changes, redo the patch.
- Strudel is AGPL-3.0; a distributed derivative must be AGPL too.
