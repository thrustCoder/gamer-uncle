import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';

test.describe('Dice Roller Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    // Initialize app and navigate to Dice Roller
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Dice Roller',
      '[data-testid="dice-button"], img[src*="dice_icon"]',
      '[data-testid="dice-roller"]'
    );
    await expect(page.locator('[data-testid="dice-roller"]')).toBeVisible();
  });

  test('should display dice roller screen with toggle buttons', async ({ page }) => {
    // Verify the toggle container is visible
    await expect(page.locator('[data-testid="dice-roller"]')).toBeVisible();
    
    // Verify both toggle buttons are visible
    await expect(page.getByText('1 Die')).toBeVisible();
    await expect(page.getByText('2 Dice')).toBeVisible();
  });

  test('should display one die by default', async ({ page }) => {
    // Verify dice display area is visible
    await expect(page.locator('[data-testid="dice-display"]')).toBeVisible();
    
    // Verify exactly one die is displayed
    await expect(page.locator('[data-testid="dice-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="dice-1"]')).not.toBeVisible();
  });

  test('should switch to two dice when 2 Dice button is pressed', async ({ page }) => {
    // Click the 2 Dice button
    await page.getByText('2 Dice').click();
    
    // Wait for the UI to update
    await page.waitForTimeout(300);
    
    // Verify both dice are visible
    await expect(page.locator('[data-testid="dice-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="dice-1"]')).toBeVisible();
  });

  test('should switch back to one die when 1 Die button is pressed', async ({ page }) => {
    // First switch to 2 dice
    await page.getByText('2 Dice').click();
    await page.waitForTimeout(300);
    
    // Verify both dice are visible
    await expect(page.locator('[data-testid="dice-1"]')).toBeVisible();
    
    // Switch back to 1 die
    await page.getByText('1 Die').click();
    await page.waitForTimeout(300);
    
    // Verify only one die is visible
    await expect(page.locator('[data-testid="dice-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="dice-1"]')).not.toBeVisible();
  });

  test('should have roll button enabled', async ({ page }) => {
    // Verify roll button is visible and enabled
    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeVisible();
    await expect(rollButton).toBeEnabled();
  });

  test('should display both dice within viewport when 2 dice selected', async ({ page }) => {
    // Switch to 2 dice
    await page.getByText('2 Dice').click();
    await page.waitForTimeout(300);
    
    // Get viewport size
    const viewportSize = page.viewportSize();
    if (!viewportSize) {
      throw new Error('Viewport size not available');
    }
    
    // Get bounding boxes of both dice
    const dice0 = await page.locator('[data-testid="dice-0"]').boundingBox();
    const dice1 = await page.locator('[data-testid="dice-1"]').boundingBox();
    
    if (!dice0 || !dice1) {
      throw new Error('Could not get bounding boxes for dice');
    }
    
    // Verify both dice are fully within the viewport
    expect(dice0.x).toBeGreaterThanOrEqual(0);
    expect(dice0.x + dice0.width).toBeLessThanOrEqual(viewportSize.width);
    
    expect(dice1.x).toBeGreaterThanOrEqual(0);
    expect(dice1.x + dice1.width).toBeLessThanOrEqual(viewportSize.width);
    
    // Verify dice don't overlap significantly (allow some margin for styling)
    const overlapThreshold = 20; // Allow up to 20px overlap for styling purposes
    const dice0Right = dice0.x + dice0.width;
    const actualOverlap = dice0Right - dice1.x;
    
    expect(actualOverlap).toBeLessThan(dice0.width * 0.5); // Dice shouldn't overlap more than 50%
  });

  test('should navigate back when back button is pressed', async ({ page }) => {
    // Click the back button
    await page.locator('[data-testid="back-button"]').click();
    
    // Verify we're back on the landing page
    await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
  });
});
