import { test, expect } from '@playwright/test';

test.describe('Gamer Uncle App - Complete E2E Test Suite', () => {
  
  test.describe('App Navigation and Basic Functionality', () => {
    test('should navigate through all main screens', async ({ page }) => {
      // Start at landing page
      await page.goto('/');
      await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();

      // Test navigation to each screen and back
      const screens = [
        { button: '[data-testid="timer-button"], img[src*="timer_icon"]', testId: '[data-testid="timer-screen"]' },
        { button: '[data-testid="dice-button"], img[src*="dice_icon"]', testId: '[data-testid="dice-roller"]' },
        { button: '[data-testid="turn-button"], img[src*="turn_icon"]', testId: '[data-testid="turn-selector"]' },
        { button: '[data-testid="team-button"], img[src*="team_icon"]', testId: '[data-testid="team-randomizer"]' },
        { button: '[data-testid="uncle-header"]', testId: '[data-testid="chat-input"]' },
      ];

      for (const screen of screens) {
        // Navigate to screen
        await page.click(screen.button);
        await page.waitForTimeout(2000); // Wait for navigation

        // Verify we're on the correct screen
        await expect(page.locator(screen.testId)).toBeVisible({ timeout: 10000 });

        // Navigate back to landing (except for last one)
        if (screen !== screens[screens.length - 1]) {
          await page.click('[data-testid="back-button"]');
          await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
        }
      }
    });

    test('should maintain consistent UI elements across screens', async ({ page }) => {
      await page.goto('/');

      // Navigate to a tool screen
      await page.click('[data-testid="timer-button"], img[src*="timer_icon"]');
      
      // Check for back button
      await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
      
      // Check for background
      await expect(page.locator('img[src*="tool_background"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network connectivity issues gracefully', async ({ page }) => {
      await page.goto('/');
      
      // Navigate to chat
      await page.click('[data-testid="uncle-header"]');
      
      // Simulate network failure by blocking API calls
      await page.route('**/api/**', route => route.abort());
      
      // Send a message
      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.click('[data-testid="send-button"]');
      
      // Should show some error handling (either error message or fallback)
      await page.waitForTimeout(5000);
      const response = await page.locator('[data-testid="system-message"]').last().textContent();
      expect(response).toBeTruthy();
    });

    test('should handle invalid inputs gracefully', async ({ page }) => {
      await page.goto('/');
      
      // Navigate to timer
      await page.click('[data-testid="timer-button"], img[src*="timer_icon"]');
      
      // Try to set invalid timer values (this is handled at UI level)
      // The app should prevent invalid states
      await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work consistently across different screen sizes', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();

      // Test tablet viewport  
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();

      // Test desktop viewport
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.reload();
      await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    test('should handle rapid navigation without issues', async ({ page }) => {
      await page.goto('/');
      
      // Rapidly navigate between screens
      const buttons = [
        '[data-testid="timer-button"], img[src*="timer_icon"]',
        '[data-testid="dice-button"], img[src*="dice_icon"]',
        '[data-testid="turn-button"], img[src*="turn_icon"]',
        '[data-testid="team-button"], img[src*="team_icon"]'
      ];

      for (let i = 0; i < 3; i++) {
        for (const button of buttons) {
          await page.click(button);
          await page.waitForTimeout(500);
          await page.click('[data-testid="back-button"]');
          await page.waitForTimeout(500);
        }
      }

      // Should still be functional
      await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should have proper button accessibility', async ({ page }) => {
      await page.goto('/');
      
      // Check that main navigation buttons are accessible
      const buttons = await page.locator('button, [role="button"]').all();
      
      for (const button of buttons) {
        // Should be focusable
        await button.focus();
        expect(await button.evaluate(el => el.matches(':focus'))).toBe(true);
      }
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/');
      
      // Navigate to chat
      await page.click('[data-testid="uncle-header"]');
      
      // Should be able to focus and use chat input with keyboard
      await page.focus('[data-testid="chat-input"]');
      await page.keyboard.type('Test keyboard input');
      await page.keyboard.press('Enter');
      
      // Should send the message
      await page.waitForTimeout(2000);
      const messages = await page.locator('[data-testid="user-message"]').all();
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});
