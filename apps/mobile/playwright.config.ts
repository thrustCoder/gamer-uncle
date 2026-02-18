import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['line'],
    ['github']
  ] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || (process.env.CI ? 'https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net' : 'http://localhost:8081'),

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Global timeout for actions */
    actionTimeout: process.env.CI ? 10000 : 30000,
    
    /* Global timeout for navigation */
    navigationTimeout: process.env.CI ? 20000 : 60000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use headless mode in CI for performance
        ...(process.env.CI && { headless: true })
      },
    },
    // Dont need to test on other browsers
  ],

  /* Run your local dev server before starting the tests */
  webServer: (process.env.E2E_BASE_URL || process.env.CI) ? undefined : {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000, // 1 minute for Expo to start
    stdout: 'pipe',
    stderr: 'pipe',
  },

  /* Global test timeout */
  timeout: process.env.CI ? 20 * 1000 : 60 * 1000, // Shorter timeout in CI

  /* Expect timeout */
  expect: {
    timeout: process.env.CI ? 3 * 1000 : 10 * 1000, // Shorter expect timeout in CI
  },
});
