import { defineConfig } from 'vitest/config';

const packageAliases = [
  { find: '@fps-games/editor-babylon/legacy-runtime', replacement: new URL('./packages/editor-babylon/src/legacy-runtime.ts', import.meta.url).pathname },
  { find: '@fps-games/editor', replacement: new URL('./packages/editor/src/index.ts', import.meta.url).pathname },
  { find: '@fps-games/editor-core', replacement: new URL('./packages/editor-core/src/index.ts', import.meta.url).pathname },
  { find: '@fps-games/editor-browser', replacement: new URL('./packages/editor-browser/src/index.ts', import.meta.url).pathname },
  { find: '@fps-games/editor-forge-play', replacement: new URL('./packages/editor-forge-play/src/index.ts', import.meta.url).pathname },
  { find: '@fps-games/editor-babylon', replacement: new URL('./packages/editor-babylon/src/index.ts', import.meta.url).pathname },
  { find: '@fps-games/editor-protocol', replacement: new URL('./packages/editor-protocol/src/index.ts', import.meta.url).pathname },
];

export default defineConfig({
  resolve: {
    alias: packageAliases,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
