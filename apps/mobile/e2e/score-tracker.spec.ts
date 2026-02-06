import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';
import { TIMEOUTS } from './test-data';

test.describe('Score Tracker Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    // Initialize app and navigate to Score Tracker
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Score Tracker',
      '[data-testid="score-button"]',
      '[data-testid="add-game-score-button"], [data-testid="game-score-section"]'
    );
  });

  test('should display Score Tracker title', async ({ page }) => {
    const title = page.getByText('Score Tracker');
    await expect(title).toBeVisible();
  });

  test('should show empty state with Add Game Score button', async ({ page }) => {
    // Empty state should show add buttons
    const addGameScoreButton = page.locator('[data-testid="add-game-score-button"]');
    await expect(addGameScoreButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('should show empty state with Add Leaderboard button', async ({ page }) => {
    const addLeaderboardButton = page.locator('[data-testid="add-leaderboard-button"]');
    await expect(addLeaderboardButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('should display player name input fields', async ({ page }) => {
    // Look for player input fields
    const playerInputs = page.locator('input');
    const count = await playerInputs.count();
    
    // Should have at least 2 player inputs (minimum for a game)
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should allow editing player names', async ({ page }) => {
    // Get the first player input
    const firstInput = page.locator('input').first();
    
    // Clear and enter a new name
    await firstInput.click();
    await firstInput.selectText();
    await firstInput.fill('TestPlayer');
    
    // Verify the name was entered
    await expect(firstInput).toHaveValue('TestPlayer');
  });

  test('should navigate to Score Input when Add Game Score is clicked', async ({ page }) => {
    // Click Add Game Score button
    const addGameScoreButton = page.locator('[data-testid="add-game-score-button"]').first();
    await addGameScoreButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(TIMEOUTS.NAVIGATION);
    
    // Should see game search modal or score input screen
    const gameSearchModal = page.locator('[data-testid="game-search-modal"], [data-testid="score-input-screen"]');
    await expect(gameSearchModal.first()).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });

  test('should navigate to Leaderboard input when Add Leaderboard is clicked', async ({ page }) => {
    // Click Add Leaderboard button
    const addLeaderboardButton = page.locator('[data-testid="add-leaderboard-button"]').first();
    await addLeaderboardButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(TIMEOUTS.NAVIGATION);
    
    // Should see game search modal or leaderboard input screen
    const inputScreen = page.locator('[data-testid="game-search-modal"], [data-testid="score-input-screen"]');
    await expect(inputScreen.first()).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });

  test('should have back button visible', async ({ page }) => {
    const backButton = page.locator('[data-testid="back-button"]');
    await expect(backButton).toBeVisible();
  });

  test('should navigate back to landing when back button is clicked', async ({ page }) => {
    // Click back button
    const backButton = page.locator('[data-testid="back-button"]');
    await backButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(TIMEOUTS.NAVIGATION);
    
    // Should be back on landing page
    const landingIndicator = page.locator('[data-testid="center-circle"], [data-testid="uncle-header"]');
    await expect(landingIndicator.first()).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });
});

test.describe('Score Tracker - Player Count', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Score Tracker',
      '[data-testid="score-button"]',
      '[data-testid="add-game-score-button"], [data-testid="game-score-section"]'
    );
  });

  test('should show player count selector', async ({ page }) => {
    // Look for player count picker or stepper
    const playerCountPicker = page.locator('[data-testid="player-count-picker"], [data-testid="player-count"]');
    await expect(playerCountPicker.first()).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('should allow multiple player name entries', async ({ page }) => {
    // Get all player inputs
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    // Fill in each player name
    for (let i = 0; i < Math.min(inputCount, 4); i++) {
      const input = inputs.nth(i);
      await input.click();
      await input.fill(`Player${i + 1}`);
    }
    
    // Verify all names were entered
    for (let i = 0; i < Math.min(inputCount, 4); i++) {
      await expect(inputs.nth(i)).toHaveValue(`Player${i + 1}`);
    }
  });
});
