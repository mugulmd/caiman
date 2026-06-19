# Notes — ideas parked for later

Things worth building eventually but deliberately deferred. Not committed plans.

## One-shot transitions (tempo ramps, filter sweeps, …)

**Status:** deferred. For now, tempo is just `setcps(...)` written in the session
code (code-owned, tweaked live by editing `live.js`). Good enough.

**The problem.** Strudel patterns are *stateless functions of absolute cycle
time, re-queried every tick* — they have no memory of "when did I start." So a
**one-shot, time-anchored, settling gesture** ("from now, ramp A→B over T, then
hold") is awkward to express. This is the same shape for tempo ramps, filter
cutoff sweeps, gain fades, A→B crossfades — all "transitions."

Two clarifications that matter:
- Re-saving does **not** reset the cycle clock — `setPattern` keeps the scheduler
  running, so anything anchored to *absolute* cycle survives a re-save.
- What "restarts" is **periodicity**: `saw`/`sine`/`slow` loop every period, so a
  ramp built from them repeats. That's inherent, not a re-save bug.

**Strudel building blocks:**
- `time` — absolute, ever-increasing cycle count (`signal(t => t)`), vs `saw` =
  periodic `t % 1`. The escape hatch for one-shots (anchor to absolute cycle,
  clamp, hold). Survives re-saves; downside is you must supply the start cycle.
- `saw`/`isaw`/`sine`/`tri` — periodic ramps (loop).
- `xfade(a, pos, b)` — crossfade two patterns by a position signal (A→B sections).
- `lpenv`/`bpenv`/… — per-**note** envelopes, not section-level.
- No Tidal-style eval-time transitions (`clutch`/`xfadeIn`/`anticipate`) exist.

**Options, smallest → most powerful:**

- **A — expose "now" + a one-shot ramp helper (near-zero build).** Show the
  current cycle in the player; provide a pure `ramp(fromCycle, lengthCycles, lo,
  hi)` built on `time` (ramps then holds). Drop it into any param: `.cps(ramp(…))`,
  `.lpf(ramp(…))`, etc. Survives re-saves, fully code-owned, no hidden state.
  Friction: read the cycle counter and type a start cycle. **Recommended starting
  point.**
- **B — fire-once transitions (`once`).** `once(id, fn)` that the player remembers:
  fires on first eval, skipped on re-saves with the same `id`; change the `id` to
  re-fire. Pair with imperative one-shots the player runs against the clock
  (`once('build', () => rampTempo(0.5, 1, 8))`). Fire-and-forget ergonomics,
  re-save-safe; cost: a little state in the player.
- **C — named control bus (general solution).** Player holds named live params
  (`cps`, `cutoff`, `drive`…). Patterns *read* them (`.lpf(bus('cutoff'))`);
  transitions *write* them (one-shot ramps run by the player), so editing the
  pattern never disturbs an in-flight transition. Fire via `once(...)` or player
  UI knobs. Unifies tempo + filters + gain + crossfades as "automatable live
  params." Most powerful; real build (bus state, a signal helper for patterns to
  read it, a ramp scheduler, the `once` registry, types/validation).

**Tradeoff:** A keeps everything stateless and in the pattern (pay with manual
cycle anchoring); B/C move transitions into a stateful player layer (smoother to
fire, but hidden runtime state, more machinery, and tempo stops being purely
code-owned).

**Open questions if/when we build this:** lightweight (A) vs control bus (C); and
whether transitions fire only from code (`once`-id) or also from the player UI.
