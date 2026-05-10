import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'https://ennffie.github.io/taskflow-v2/',
    headless: true,
    viewport: { width: 430, height: 932 },
    ignoreHTTPSErrors: true,
  },
  reporter: 'list',
});
