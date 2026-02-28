import { test, expect } from '@playwright/test';

test.describe('Landing Navigation', () => {
  test('should load landing page and navigate to chat', async ({ page }) => {
    await page.goto('/');
    
    // Verify landing page loads
    await expect(page.locator('[data-testid="center-circle"]')).toBeVisible();
    
    // Navigate to chat
    await page.click('[data-testid="center-circle"]');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });
});
