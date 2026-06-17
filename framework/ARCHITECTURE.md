# caiman architecture

caiman is a local live-coding framework for [Strudel](https://strudel.cc): you
edit a plain `.js` file in your own editor, and a browser tab plays the audio,
hot-swapping the pattern on every save. The framework is written once; each
music project is a lightweight **session**.

## The loop

```
   Zed ── save ──▶ sessions/<name>/live.js
                          │
┌──────────── caiman server (bun, ONE process) ─────────────────────────────┐
│  chokidar watches sessions/<name>/{live,setup}.js                          │
│      │ read source string                                                  │
│      ▼                                                                      │
│  validate(source) in Node ──fail──▶ log error to terminal, DON'T push      │
│      │ ok                                  (browser keeps last-good audio) │
│      ▼                                                                      │
│  socket.io ──emit {code}/{setup}──▶ │   + serves the web app (same port)   │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                       │ socket.io (auto-reconnect)
                                       ▼
┌──────────── browser web app (@strudel/web) ───────────────────────────────┐
│  on connect:  receive {setup, code} → inject globals →                     │
│               run setup once (load samples / register synths) → ready      │
│  on {code}:   evaluate(code) → scheduler.setPattern(pattern)   // hot-swap  │
│  on error:    emit {error} back → server prints it in your terminal        │
│  [one click to unlock AudioContext]                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Principles

1. **The web app is a dumb player.** It's a fixed bundle (`@strudel/web` +
   socket.io client + scheduler glue). It never imports session files — it plays
   whatever source the server sends. Switching projects = restart the server at
   another session; the page reconnects and gets the new code.

2. **Check-time and run-time use the same evaluator.** Both the server's
   validation and the browser's execution call Strudel's `evaluate(source)`.
   Identical semantics, no drift. Because we evaluate a *string* (not a file
   path), there's no module-source caching to fight — the server holds one
   long-lived Strudel context and validates in-process.

3. **A bad edit never kills the sound.** Validation failure ⇒ don't push ⇒ the
   last-good pattern keeps playing, error prints in the terminal. Good edits
   hot-swap at the next cycle boundary via `scheduler.setPattern`.

## Layout

```
framework/                 # the engine — written once, shared by all sessions
  strudel.js               # prelude: re-exports core+mini (+webaudio later),
                           #   installs the mini-notation parser
  strudel.globals.d.ts     # generated ambient global types → autocomplete/hover
  server/                  # watch + validate + socket.io + serve   (P1/P3)
  web/                     # the dumb player                        (P2)
  scripts/
    gen-types.js           # regenerate strudel.globals.d.ts from the registry
    new-session.js         # `bun run new <name>` → copies _template
    check.js / watch.js    # standalone one-shot / terminal checker (pre-server)
sessions/
  _template/               # the session template
    live.js                #   pattern — hot-swapped, fully validated
    setup.js               #   samples()/registerSound() — browser-only, syntax-checked
    session.json           #   title + notes (tempo lives in code via setcps)
  <your projects…>/
```

A single root `jsconfig.json` includes `sessions/**/*.js` and the framework
`.d.ts`, so editing any session file gets the Strudel globals with no per-session
config. Autocomplete/hover is purely static (editor-side) and independent of how
code is validated or run.

## Socket protocol

| direction | event | payload | when |
|---|---|---|---|
| server → browser | `session` | `{ name, setup, code }` | on (re)connect — full snapshot |
| server → browser | `code` | `{ source, ts }` | live.js changed and passed validation |
| server → browser | `setup` | `{ source, ts }` | setup.js changed |
| browser → server | `runtime-error` | `{ phase, message }` | error that only surfaces in the browser |

Validation split: `live.js` gets a full `evaluate()`; `setup.js` is
syntax/transpile-checked only (it touches the Web Audio context, which doesn't
exist in Node).

## Build milestones

- **P0 — reshape** *(done)*: framework/ + sessions/ layout, `_template`,
  `new-session`. Gate: autocomplete + one-shot check still work.
- **P1 — server evaluate()** *(done)*: `framework/server/validate.js` validates a
  source string via `evaluate(source, transpiler)` — proven headless in Node.
  `check.js`/`watch.js` now use it; the watcher validates **in-process** (the
  string-based path has no module cache to defeat, so the old subprocess-per-save
  is gone). Added dep: `@strudel/transpiler`.
- **P2 — web player** *(built; awaiting audio confirmation)*: `framework/web/`
  (Vite). Uses the individual packages (not the `@strudel/web` bundle) so the
  browser shares the same core version line as the Node validator. Hot-swap =
  `repl().evaluate(code)`, which runs the same core `evaluate(code, transpiler)`
  then `scheduler.setPattern`. Default `bd/sd/hh` come from prebaking
  `samples('github:tidalcycles/dirt-samples')`; default synths from
  `registerSynthSounds()`. A bun `overrides` pins `@strudel/core` to one version
  so the browser bundle has a single `Pattern`/registry. `bun run web`.
- **P3 — socket wire**: edit `live.js` → validate → push → hear it.
- **P4 — setup.js**: push/run samples + synths on connect; extend `gen-types`
  to include `@strudel/webaudio`.
- **P5 — polish**: error round-trip, reconnect snapshot, start-audio overlay,
  session switching.

## Open questions / risks (verified as gates, not assumed)

- ~~Does `evaluate()` run headless in Node?~~ *(P1 — yes; `evaluate(source,
  transpiler)` builds the pattern with no audio. `m` from `@strudel/mini` must be
  a global, since the transpiler rewrites `"…"` into `m(...)`.)*
- ~~Exact scheduler / hot-swap API.~~ *(P2 — `repl({ defaultOutput, getTime,
  transpiler })` → `repl.evaluate(code)` transpiles, evaluates, and
  `setPattern`s in one call.)*
- ~~Default `bd/sd/hh`?~~ *(P2 — not built in; we prebake
  `samples('github:tidalcycles/dirt-samples')`. Per-session `setup.js` can add
  more in P4.)*
- ~~Multiple core copies in the browser bundle?~~ *(P2 — webaudio pins
  core@1.2.5 while we use 1.2.6; a bun `overrides` forces one version. Vite
  `resolve.dedupe` is a second guard.)*
- Vite middleware-mode + socket.io on one HTTP server / port. *(P3)*
