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
- **P1 — server evaluate()**: prove `evaluate(source)` validates headless in
  Node; replace the import-based checker.
- **P2 — web player**: Vite + `@strudel/web`, hardcoded pattern → audio via
  `scheduler.setPattern`, hot-swap.
- **P3 — socket wire**: edit `live.js` → validate → push → hear it.
- **P4 — setup.js**: push/run samples + synths on connect; extend `gen-types`
  to include `@strudel/webaudio`.
- **P5 — polish**: error round-trip, reconnect snapshot, start-audio overlay,
  session switching.

## Open questions / risks (verified as gates, not assumed)

- Does `evaluate()` run headless in Node? Fallback: transpile + `new Function`
  with globals injected (still one shared code path, minus audio). *(P1)*
- Exact scheduler / hot-swap API from `@strudel/web`. *(P2)*
- Whether `initStrudel()` prebakes default `bd/sd/hh` or we ship a default
  setup. *(P2/P4)*
- Vite middleware-mode + socket.io on one HTTP server / port. *(P3)*
