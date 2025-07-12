import { test, expect } from '@playwright/test';

test.describe('Essential App Integration', () => {
  test('should navigate to chat and handle basic interaction', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to chat
    await page.click('[data-testid="uncle-header"]');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    
    // Send a basic message
    await page.fill('[data-testid="chat-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');
    
    // Should get some response
    await page.waitForSelector('[data-testid="system-message"]', { timeout: 15000 });
    const response = await page.locator('[data-testid="system-message"]').last().textContent();
    expect(response).toBeTruthy();
  });

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
  });
});
