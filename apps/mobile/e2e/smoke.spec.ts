import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load application successfully', async ({ page }) => {
    test.setTimeout(30000);
    
    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    
    // Basic functionality check - ensure we can navigate to chat
    await page.click('[data-testid="uncle-header"]');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });
});
