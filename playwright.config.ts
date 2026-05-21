import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev:editor-lab -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
