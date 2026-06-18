# caiman

Live-code [Strudel](https://strudel.cc) from a local file in your own editor,
with autocomplete, docs-on-hover, and an evaluate-on-save correctness check —
no in-browser editor required.

caiman is a **framework + sessions**: the engine in `framework/` is written
once; each music project is a thin folder under `sessions/`. A Node server
watches your file, validates each save, and pushes valid code to a browser tab
that plays it — hot-swapping the pattern live. See
[`framework/ARCHITECTURE.md`](framework/ARCHITECTURE.md) for the design and the
build phases.

## Quick start

```bash
bun install
bun run new my-track          # scaffold sessions/my-track/ from the template
bun run session my-track      # serve the player + watch/validate/push on save
```

Open the printed URL (http://localhost:4321), click **▶ start** to enable audio,
then edit `sessions/my-track/live.js` in your editor. Every save is validated and
hot-swapped into the running audio; an invalid edit is logged in the terminal and
**not** pushed, so the last good pattern keeps playing.

Validation-only, no audio: `bun run check sessions/<name>/live.js` (one-shot;
defaults to `sessions/sandbox/live.js`). Handy for a quick manual check; during a
session the server already validates on every save.

## Custom sounds (shared library)

Drop a file in `library/` to register a synth or sample kit — it's available in
**every** session via `s("name")`. Each file is plain JS using globals
(`registerSound(...)`, `samples(...)`, `getAudioContext()`); see
[`library/mysaw.js`](library/mysaw.js) for a worked synth. Editing a library file
re-registers it live while a session runs, so you can design a sound and hear it
update. (A custom synth must stop its own nodes — `value.duration` is the note
length — or voices pile up forever.)

The **built-in** sounds Strudel loads by default (drum machines, VCSL
instruments, piano, …) are cataloged in [`sounds/builtins.md`](sounds/builtins.md).

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

- **`framework/server/validate.js`** — the correctness check, built on Strudel's
  `evaluate(source, transpiler)` — the *same* evaluation the browser uses to play
  code, so check and run can't drift. Evaluating the source surfaces JS syntax,
  mini-notation, and reference errors with no browser or audio. `check.js` is a
  thin one-shot CLI over it; the session server uses the same `validate()` on
  every save.

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
