import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';

test.describe('Team Randomizer Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    // Initialize app and navigate to Team Randomizer
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Team Randomizer',
      '[data-testid="team-button"], img[src*="team_icon"]',
      '[data-testid="team-randomizer"]'
    );
    await expect(page.locator('[data-testid="team-randomizer"]')).toBeVisible();
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

  test('should display fallback names in teams when inputs are empty', async ({ page }) => {
    // Clear the first two player inputs
    const firstPlayerInput = page.locator('input').first();
    const secondPlayerInput = page.locator('input').nth(1);
    
    await firstPlayerInput.click();
    await firstPlayerInput.selectText();
    await firstPlayerInput.press('Delete');
    
    await secondPlayerInput.click();
    await secondPlayerInput.selectText();
    await secondPlayerInput.press('Delete');
    
    // Click the randomize button
    await page.click('button:has-text("RANDOMIZE")');
    
    // Wait for teams to be generated
    await page.waitForTimeout(1000);
    
    // The teams should show fallback names (P1, P2, etc.)
    const teamCards = page.locator('[data-testid*="team"], .team-card, div:has-text("TEAM")');
    await expect(teamCards.first()).toBeVisible();
    
    // Check for presence of fallback names
    await expect(page.locator('text=P1')).toBeVisible();
    await expect(page.locator('text=P2')).toBeVisible();
  });

  test('should maintain custom names in teams when some inputs are custom', async ({ page }) => {
    // Set custom names for first two players, leave others default
    const firstPlayerInput = page.locator('input').first();
    const secondPlayerInput = page.locator('input').nth(1);
    
    await firstPlayerInput.click();
    await firstPlayerInput.selectText();
    await firstPlayerInput.type('Alice');
    
    await secondPlayerInput.click();
    await secondPlayerInput.selectText();
    await secondPlayerInput.type('Bob');
    
    // Clear third player input 
    const thirdPlayerInput = page.locator('input').nth(2);
    await thirdPlayerInput.click();
    await thirdPlayerInput.selectText();
    await thirdPlayerInput.press('Delete');
    
    // Click the randomize button
    await page.click('button:has-text("RANDOMIZE")');
    
    // Wait for teams to be generated
    await page.waitForTimeout(1000);
    
    // The teams should show custom names and fallback names
    const teamCards = page.locator('[data-testid*="team"], .team-card, div:has-text("TEAM")');
    await expect(teamCards.first()).toBeVisible();
    
    // Check for presence of custom names
    await expect(page.locator('text=Alice')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();
    
    // Check for presence of fallback name for cleared input
    await expect(page.locator('text=P3')).toBeVisible();
  });
});
