import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';

test.describe('Turn Selector Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    // Initialize app and navigate to Turn Selector
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Turn Selector',
      '[data-testid="turn-button"], img[src*="turn_icon"]',
      '[data-testid="turn-selector"]'
    );
    await expect(page.locator('[data-testid="turn-selector"]')).toBeVisible();
  });

  test('should allow clearing player names without auto-populating', async ({ page }) => {
    // Get the first player name input
    const firstPlayerInput = page.locator('input').first();
    
    // Clear the input completely
    await firstPlayerInput.click();
    await firstPlayerInput.selectText();
    await firstPlayerInput.press('Delete');
    
    // Verify the input is empty and doesn't auto-populate
    await expect(firstPlayerInput).toHaveValue('');
    
    // Wait a moment to ensure no auto-population occurs
    await page.waitForTimeout(500);
    await expect(firstPlayerInput).toHaveValue('');
  });

  test('should allow setting custom names after clearing', async ({ page }) => {
    // Get the first player name input
    const firstPlayerInput = page.locator('input').first();
    
    // Clear the input and set a custom name
    await firstPlayerInput.click();
    await firstPlayerInput.selectText();
    await firstPlayerInput.press('Delete');
    await firstPlayerInput.type('Alice');
    
    // Verify the custom name is set
    await expect(firstPlayerInput).toHaveValue('Alice');
    
    // Test with second player input
    const secondPlayerInput = page.locator('input').nth(1);
    await secondPlayerInput.click();
    await secondPlayerInput.selectText();
    await secondPlayerInput.press('Delete');
    await secondPlayerInput.type('Bob');
    
    await expect(secondPlayerInput).toHaveValue('Bob');
  });

  test('should display placeholder names on spinning wheel when inputs are empty', async ({ page }) => {
    // Clear the first two player inputs
    const firstPlayerInput = page.locator('input').first();
    const secondPlayerInput = page.locator('input').nth(1);
    
    await firstPlayerInput.click();
    await firstPlayerInput.selectText();
    await firstPlayerInput.press('Delete');
    
    await secondPlayerInput.click();
    await secondPlayerInput.selectText();
    await secondPlayerInput.press('Delete');
    
    // The spinning wheel should show fallback names (P1, P2, etc.)
    // Note: SVG text elements might need different selectors
    await expect(page.locator('text=P1')).toBeVisible();
    await expect(page.locator('text=P2')).toBeVisible();
  });

  test('should show placeholder in input when empty', async ({ page }) => {
    // Get the first player name input
    const firstPlayerInput = page.locator('input').first();
    
    // Clear the input completely
    await firstPlayerInput.click();
    await firstPlayerInput.selectText();
    await firstPlayerInput.press('Delete');
    
    // Check if placeholder is visible (placeholder text should be "Player 1")
    await expect(firstPlayerInput).toHaveAttribute('placeholder', 'Player 1');
  });

});
