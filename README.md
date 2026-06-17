# caiman

Live-code [Strudel](https://strudel.cc) from a local file in your own editor,
with autocomplete, docs-on-hover, and an evaluate-on-save correctness check —
no in-browser editor required.

caiman is a **framework + sessions**: the engine in `framework/` is written
once; each music project is a thin folder under `sessions/`. The browser-audio
layer (a server that pushes code to a `@strudel/web` page) is being built in
phases — see [`framework/ARCHITECTURE.md`](framework/ARCHITECTURE.md).

## Quick start

```bash
bun install
bun run new my-track          # scaffold sessions/my-track/ from the template
bun run watch sessions/my-track/live.js   # re-check on every save (pane)
```

Edit `sessions/<name>/live.js`. On save you get a green ✓ or a red ✗ with the
error and location. One-shot: `bun run check sessions/<name>/live.js`
(defaults to `sessions/sandbox/live.js`).

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

- **`framework/strudel.js`** — a prelude that re-exports `@strudel/core` and
  installs the mini-notation parser (`setStringParser(mini)`). You never import
  it; the checker loads it and copies its exports onto `globalThis` so your
  patterns can call them without imports.

- **`framework/strudel.globals.d.ts`** — generated, permissive **ambient
  global** type stubs that power autocomplete and hover with no import. Names
  come from runtime introspection of Strudel's registry; hover docs are parsed
  from the JSDoc in the packages' shipped source. Every function is typed
  `(...args: any[]) => Pattern` so chains complete — the types are **not** meant
  to be accurate. Regenerate after upgrading Strudel: `bun run gen-types`.

- **`framework/scripts/check.js` + `watch.js`** — the correctness check. It
  injects the Strudel globals, then imports your file. Because Strudel parses
  mini-notation eagerly, loading the file surfaces **both** JS errors and
  mini-notation errors — with no browser, audio, or transpiler. The watcher runs
  each check in a fresh subprocess (~40ms) because a long-lived process caches
  module source by path. (P1 will move this to a shared `evaluate(source)` path
  inside the server.)

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
