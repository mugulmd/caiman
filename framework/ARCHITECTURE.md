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
│  chokidar watches sessions/<name>/live.js  +  library/**/*.js              │
│      │ read source string                                                  │
│      ▼                                                                      │
│  validate(source) in Node ──fail──▶ log error to terminal, DON'T push      │
│      │ ok                                  (browser keeps last-good audio) │
│      ▼                                                                      │
│  socket.io ──emit {code}/{library}──▶ │   + serves the web app (same port) │
└──────────────────────────────────────┼─────────────────────────────────────┘
                                        │ socket.io (auto-reconnect)
                                        ▼
┌──────────── browser web app (@strudel/web) ───────────────────────────────┐
│  on connect:  receive {library, code} → inject globals →                   │
│               run library once (register all synths/samples) → ready       │
│  on {code}:    evaluate(code) → scheduler.setPattern(pattern)  // hot-swap  │
│  on {library}: re-run library → re-register synths/samples     // live      │
│  on error:     emit {error} back → server prints it in your terminal       │
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
library/                   # SHARED sounds — registered in EVERY session
  *.js                     #   one file per synth / sample kit; your collection
sessions/
  _template/               # the session template
    live.js                #   pattern — hot-swapped, fully validated
    session.json           #   title + notes (tempo lives in code via setcps)
  <your projects…>/
```

A single root `jsconfig.json` includes `sessions/**/*.js`, `library/**/*.js`,
and the framework `.d.ts`, so editing any of them gets the Strudel globals
(`note`/`s`/… and `samples`/`registerSound`/…) with no per-file config.
Autocomplete/hover is purely static (editor-side) and independent of how code is
validated or run.

### Sound library

`library/**/*.js` is a shared collection of synths and samples, registered in
**every** session — you design a sound once and have it everywhere. Each file is
plain side-effect JS using globals (`registerSound(...)`, `samples(...)`,
`getAudioContext()`, …) — no imports, not transpiled (its strings are URLs /
sample names, not mini-notation). The server syntax-checks each file, sends them
in the connect snapshot, and watches the tree; editing a file re-registers its
sounds **live** (superdough looks sounds up at trigger time, so the next note
uses the new definition — no restart). A file that fails the syntax check is
skipped and reported; the others still load. There is no per-session setup —
the library is the single place for all sounds.

## Socket protocol

| direction | event | payload | when |
|---|---|---|---|
| server → browser | `session` | `{ name, library, code }` | on (re)connect — full snapshot |
| server → browser | `code` | `{ source, ts }` | live.js changed and passed validation |
| server → browser | `library` | `{ files: [{file, source}], ts }` | a library file changed/added/removed |
| server → browser | `validation-error` | `{ phase, message, loc }` | a check failed (shown in the player's banner) |
| browser → server | `runtime-error` | `{ phase, message }` | error that only surfaces in the browser |

Validation split: `live.js` gets a full `evaluate()`; library files are
syntax-checked only (they touch the Web Audio context, which doesn't exist in
Node — they're parsed via `new AsyncFunction(src)`, not run).

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
- **P3 — socket wire** *(built; headless-verified, awaiting live audio
  confirmation)*: `framework/server/index.js` (`bun run session <name>`) runs Vite
  + socket.io on one port, watches the session (chokidar), validates on change,
  and pushes valid `code` (rejects invalid, logging it — last good keeps
  playing). The player (`main.js`) is now socket-driven: snapshot on connect,
  hot-swap on `code`, and reports browser runtime errors back to the terminal.

  Two websocket gotchas, both fixed:
  - **socket.io is websocket-only** (`transports: ['websocket']`). HTTP
    long-polling doesn't survive sharing the port with Vite — the client never
    stayed connected.
  - **Vite HMR runs on its own port** (`hmr: { port: 24679 }`), not disabled.
    `hmr: false` still injects `@vite/client`, which opens an HMR websocket to
    :4321; with no server there it logs "connection lost", pings, and calls
    `location.reload()` — a full-page reload loop ~1×/s. A real HMR server on a
    separate port stops that and keeps socket.io alone on 4321 (no shared
    upgrade-handler fight). Only 4321 is user-facing.

  The player also skips re-evaluating identical source, so a legitimate
  reconnect resumes without restarting from cycle 0. Verified headlessly: HMR ws
  accepts connections on 24679; socket.io snapshot/valid-push/invalid-reject/
  restore all pass on 4321.
- **P4 — custom sounds**: the browser runs registration code (plain JS via
  `AsyncFunction`, no transpile — strings are URLs/sample names) to register
  samples/synths, then plays `code`. `gen-types` also emits `@strudel/webaudio`'s
  functions (`samples`, `registerSound`, `getAudioContext`, … typed `=> any`) as
  globals so they autocomplete. *(Originally per-session `setup.js`; superseded
  by the shared library in P6.)*
- **P5 — polish** *(built; awaiting visual confirmation)*: the player now has a
  start-audio overlay (captures the gesture browsers require), a connection dot
  (live / offline / connecting), an error banner, and a pause/resume toggle
  (via `repl.toggle()` + `onToggle`). The server emits `validation-error` on a
  failed check so the browser shows *why* a save didn't take effect (the
  last-good pattern keeps playing); the banner clears on the next good push.
  Browser runtime errors still round-trip to the terminal. `bun run session`
  with an unknown name lists the available sessions. Verified headlessly:
  validation-error reaches the client, good edits still push, session listing.
- **P6 — shared library**: custom sounds moved from per-session `setup.js` to a
  shared `library/**/*.js` registered in every session (one file per synth/kit).
  The server discovers, syntax-checks, snapshots, and watches the tree; editing a
  file re-registers live. Per-session `setup.js` removed. `jsconfig` includes
  `library/`. Verified headlessly: snapshot carries the library; a file edit
  pushes a `library` event.

## Open questions / risks (verified as gates, not assumed)

- ~~Does `evaluate()` run headless in Node?~~ *(P1 — yes; `evaluate(source,
  transpiler)` builds the pattern with no audio. `m` from `@strudel/mini` must be
  a global, since the transpiler rewrites `"…"` into `m(...)`.)*
- ~~Exact scheduler / hot-swap API.~~ *(P2 — `repl({ defaultOutput, getTime,
  transpiler })` → `repl.evaluate(code)` transpiles, evaluates, and
  `setPattern`s in one call.)*
- ~~Default `bd/sd/hh`?~~ *(P2 — not built in; we prebake
  `samples('github:tidalcycles/dirt-samples')`. The shared `library/` adds more.)*
- ~~Multiple core copies in the browser bundle?~~ *(P2 — webaudio pins
  core@1.2.5 while we use 1.2.6; a bun `overrides` forces one version. Vite
  `resolve.dedupe` is a second guard.)*
- ~~Vite + socket.io on one port?~~ *(P3 — yes: socket.io attaches to Vite's
  own `httpServer` on path `/caiman.io`; Vite HMR runs on its own port (24679),
  so there's no websocket-upgrade conflict.)*
