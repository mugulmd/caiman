import { defineConfig } from 'vite';

// The web player. Run from the repo root: `bun run web`.
// dedupe keeps a single @strudel/core instance in the bundle (one Pattern class
// + one sound registry), which is essential for triggers to resolve.
export default defineConfig({
  resolve: {
    dedupe: ['@strudel/core', '@strudel/mini', '@strudel/transpiler'],
  },
  server: { port: 4321 },
});
