import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright Configuration for py-editor Client E2E Tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './__tests__/e2e',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 3,
    reporter: 'html',
    timeout: 30000,
    globalTeardown: path.resolve(__dirname, './__tests__/global-teardown.js'),

    use: {
        baseURL: 'http://localhost:8080',
        headless: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Force headless mode for VSCode extension
                launchOptions: {
                    headless: true,
                },
            },
        },
    ],

    // Automatically start server for local development only
    // In CI, server is started explicitly in GitHub Actions
    webServer: process.env.CI
        ? undefined
        : {
              command: 'cd ../server && npm start',
              url: 'http://localhost:8080',
              timeout: 120000,
              reuseExistingServer: true,
          },
});
