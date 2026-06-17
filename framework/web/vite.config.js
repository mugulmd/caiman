import { defineConfig } from 'vite';

// The web player. Run from the repo root: `bun run web`.
// dedupe keeps a single @strudel/core instance in the bundle (one Pattern class
// + one sound registry), which is essential for triggers to resolve.
export default defineConfig({
  resolve: {
    dedupe: ['@strudel/core', '@strudel/mini', '@strudel/transpiler'],
  },
  // HMR runs on its OWN websocket port (24679), separate from the main server.
  // Two reasons:
  //   1. The injected @vite/client always opens an HMR websocket; if there's no
  //      server for it (e.g. hmr:false), the client logs "connection lost",
  //      pings, succeeds, and calls location.reload() — a full-page reload loop
  //      ~1×/s. Giving it a real ws server stops that.
  //   2. Keeping HMR on a separate port leaves socket.io alone on 4321, so the
  //      two websocket servers never fight over the shared upgrade handler.
  // Only 4321 is user-facing; 24679 is internal.
  server: { port: 4321, hmr: { port: 24679 } },
});
