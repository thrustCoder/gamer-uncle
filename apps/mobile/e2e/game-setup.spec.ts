import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';
import { TIMEOUTS } from './test-data';

test.describe('Game Setup Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    // Initialize app
    await page.goto('/');
    await appInit.waitForAppToLoad();
  });

  test('should navigate from Landing to Game Setup', async ({ page }) => {
    // Click on the setup button
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Verify we're on the Game Setup screen
    await expect(page.getByText('Game Setup')).toBeVisible();
    await expect(page.locator('[data-testid="game-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="player-count-picker"]')).toBeVisible();
    await expect(page.locator('[data-testid="get-setup-button"]')).toBeVisible();
  });

  test('should show validation when submitting without game name', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Try to submit without entering game name
    await page.locator('[data-testid="get-setup-button"]').click();
    
    // Should show alert (dialog)
    await expect(page.getByText('Missing Game Name')).toBeVisible({ timeout: 5000 });
  });

  test('should fill in game name and submit', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Enter game name
    const gameNameInput = page.locator('[data-testid="game-name-input"]');
    await gameNameInput.fill('Catan');
    await expect(gameNameInput).toHaveValue('Catan');
    
    // Submit the form
    await page.locator('[data-testid="get-setup-button"]').click();
    
    // Should show loading state
    await expect(page.getByText('Getting Setup...')).toBeVisible({ timeout: 5000 });
    
    // Wait for response (with longer timeout for AI response)
    await expect(page.locator('[data-testid="markdown-text"]')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
    
    // Should show action buttons after response
    await expect(page.locator('[data-testid="need-more-help-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="reset-button"]')).toBeVisible();
  });

  test('should display setup instructions in markdown format', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Enter game name and submit
    await page.locator('[data-testid="game-name-input"]').fill('Ticket to Ride');
    await page.locator('[data-testid="get-setup-button"]').click();
    
    // Wait for and verify response
    const markdownText = page.locator('[data-testid="markdown-text"]');
    await expect(markdownText).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
    
    // Verify response has substantial content
    const responseText = await markdownText.textContent();
    expect(responseText?.length).toBeGreaterThan(50);
  });

  test('should navigate to Chat with context when "Need more help" is clicked', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Enter game name and submit
    await page.locator('[data-testid="game-name-input"]').fill('Pandemic');
    await page.locator('[data-testid="get-setup-button"]').click();
    
    // Wait for response
    await expect(page.locator('[data-testid="need-more-help-button"]')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
    
    // Click "Need more help"
    await page.locator('[data-testid="need-more-help-button"]').click();
    
    // Should navigate to Chat screen with context message
    await expect(page.getByText(/What else would you like to know about setting up/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Pandemic/)).toBeVisible();
  });

  test('should reset form when "New Game" is clicked', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Enter game name and submit
    const gameNameInput = page.locator('[data-testid="game-name-input"]');
    await gameNameInput.fill('Catan');
    await page.locator('[data-testid="get-setup-button"]').click();
    
    // Wait for response
    await expect(page.locator('[data-testid="reset-button"]')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
    
    // Click "New Game" to reset
    await page.locator('[data-testid="reset-button"]').click();
    
    // Form should be reset
    await expect(gameNameInput).toHaveValue('');
    await expect(page.locator('[data-testid="markdown-text"]')).not.toBeVisible();
    await expect(page.getByText('4 Players')).toBeVisible();
  });

  test('should allow changing player count', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Default should be 4 players
    await expect(page.getByText('4 Players')).toBeVisible();
    
    // Click on player count picker
    await page.locator('[data-testid="player-count-picker"]').click();
    
    // Should show alert/modal with player options
    await expect(page.getByText('Select Number of Players')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate back to landing page', async ({ page }) => {
    // Navigate to Game Setup
    await navHelper.navigateToScreen(
      'Game Setup',
      '[data-testid="setup-button"]',
      '[data-testid="game-name-input"]'
    );
    
    // Click back button
    await page.locator('[data-testid="back-button"]').click();
    
    // Should be back on landing page
    await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible({ timeout: 5000 });
  });
});
