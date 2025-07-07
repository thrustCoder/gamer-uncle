import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - CI Health Check', () => {
  // This test runs first to verify basic connectivity
  test('should load the application homepage', async ({ page }) => {
    test.setTimeout(30000); // 30 second timeout for this test
    
    console.log(`Attempting to load: ${process.env.E2E_BASE_URL || page.url()}`);
    
    try {
      await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });
      
      // Wait for any basic element to ensure the page loaded
      await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
      
      // Log success
      console.log('✅ Homepage loaded successfully');
      
      // Take a screenshot for debugging if needed
      await page.screenshot({ path: 'test-results/homepage-smoke-test.png', fullPage: true });
      
    } catch (error) {
      console.error('❌ Failed to load homepage:', error);
      
      // Try to get more diagnostic info
      try {
        await page.screenshot({ path: 'test-results/homepage-failure.png', fullPage: true });
        console.log('Page title:', await page.title());
        console.log('Page URL:', page.url());
      } catch (diagError) {
        console.error('Failed to get diagnostic info:', diagError);
      }
      
      throw error;
    }
  });

  test('should have a valid page title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
    
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    
    // Check that we have some kind of title (not empty)
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
});
