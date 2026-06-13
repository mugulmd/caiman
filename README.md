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

Just write Strudel — no imports. Every function (`note`, `s`, `n`, `stack`, …)
is a global, exactly like the Strudel REPL. The last expression is your pattern:

```js
stack(
  note('c3 [eb3 g3]*2 <bb3 a3>'),
  s('bd hh sd hh'),
)
```

Strings inside controls (`note`, `s`, `n`, …) are parsed as mini-notation. This
is plain JavaScript (explicit `stack(...)` calls, no REPL `"..."`-as-pattern
magic or `$:` track syntax), which is what lets standard editor tooling (and AI
edits) work without a transpiler.

## How it works

Three pieces, each deliberately simple:

- **`strudel.js`** — a prelude that re-exports `@strudel/core` and installs the
  mini-notation parser (`setStringParser(mini)`). You never import it; the
  checker loads it and copies its exports onto `globalThis` so your patterns can
  call them without imports.

- **`strudel.globals.d.ts`** — generated, permissive **ambient global** type
  stubs that power autocomplete and hover with no import. Names come from runtime
  introspection of Strudel's registry; hover docs are parsed from the JSDoc in
  the packages' shipped source. Every function is typed `(...args: any[]) =>
  Pattern` so chains complete — the types are **not** meant to be accurate.
  Regenerate after upgrading Strudel: `bun run gen-types`.

- **`scripts/check.mjs` + `scripts/watch.mjs`** — the correctness check. It
  injects the Strudel globals, then imports your file. Because Strudel parses
  mini-notation eagerly, loading the file surfaces **both** JS errors and
  mini-notation errors — with no browser, audio, or transpiler. The watcher runs
  each check in a fresh subprocess (~40ms) because a long-lived process caches
  module source by path.

- **`.zed/settings.json`** — disables TS auto-import completions, so each Strudel
  name shows up once (the documented global) instead of also offering an
  undocumented "import from @strudel/core" variant.

## Notes

- **Why the patch?** `@strudel/core` depends on `@kabelsalat/web`, which ships no
  `exports` field, so Node/bun resolve its CJS entry and the named import fails.
  `patches/@kabelsalat%2Fweb@0.4.1.patch` (via `bun patch`) adds the `exports`
  field; it re-applies automatically on `bun install`. If you bump Strudel and
  the kabelsalat version changes, redo the patch.
- Strudel is AGPL-3.0; a distributed derivative must be AGPL too.
