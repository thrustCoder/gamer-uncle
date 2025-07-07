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
  retries: process.env.CI ? 2 : 0,
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
    baseURL: process.env.E2E_BASE_URL || (process.env.CI ? 'https://gamer-uncle-dev-mobile.azurewebsites.net' : 'http://localhost:8081'),

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Global timeout for actions */
    actionTimeout: process.env.CI ? 15000 : 30000,
    
    /* Global timeout for navigation */
    navigationTimeout: process.env.CI ? 30000 : 60000,
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

    // Only run Firefox and Safari on full test runs (not in CI for speed)
    ...(process.env.CI ? [] : [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ]),

    /* Test against mobile viewports. */
    ...(process.env.CI ? [] : [
      {
        name: 'Mobile Chrome',
        use: { ...devices['Pixel 5'] },
      },
    ]),
    
    // Only run Mobile Safari on full test runs
    ...(process.env.CI ? [] : [
      {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
      },
    ]),
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
  timeout: process.env.CI ? 30 * 1000 : 60 * 1000, // Shorter timeout in CI

  /* Expect timeout */
  expect: {
    timeout: process.env.CI ? 5 * 1000 : 10 * 1000, // Shorter expect timeout in CI
  },
});
