import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  workers: 1, // YouTube への同時接続を避ける
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
  },
});
