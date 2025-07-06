import { test, expect } from '@playwright/test';
import { DiceRollerPage } from './dice-roller-page';

test.describe('Dice Roller Screen E2E Tests', () => {
  let diceRollerPage: DiceRollerPage;

  test.beforeEach(async ({ page }) => {
    diceRollerPage = new DiceRollerPage(page);
    
    // Navigate to dice roller through landing page
    await page.goto('/');
    await page.click('[data-testid="uncle-header"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="dice-button"], img[src*="dice_icon"]', { timeout: 10000 });
    await page.click('[data-testid="dice-button"], img[src*="dice_icon"]');
    
    await diceRollerPage.waitForPageLoad();
  });

  test.describe('Dice Rolling Functionality', () => {
    test('should display initial dice configuration', async () => {
      await diceRollerPage.verifyInitialState();
    });

    test('should be able to roll dice', async () => {
      const initialValue = await diceRollerPage.getDiceValue();
      await diceRollerPage.rollDice();
      
      // Wait for animation to complete
      await diceRollerPage.waitForRollComplete();
      
      // Verify dice shows a valid value (1-6)
      const newValue = await diceRollerPage.getDiceValue();
      expect(newValue).toBeGreaterThanOrEqual(1);
      expect(newValue).toBeLessThanOrEqual(6);
    });

    test('should be able to change dice count', async () => {
      // Test increasing dice count
      await diceRollerPage.increaseDiceCount();
      await diceRollerPage.verifyDiceCount(2);
      
      // Test rolling multiple dice
      await diceRollerPage.rollDice();
      await diceRollerPage.waitForRollComplete();
      
      const diceValues = await diceRollerPage.getAllDiceValues();
      expect(diceValues.length).toBe(2);
      diceValues.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      });
    });

    test('should be able to decrease dice count', async () => {
      // First increase, then decrease
      await diceRollerPage.increaseDiceCount();
      await diceRollerPage.decreaseDiceCount();
      await diceRollerPage.verifyDiceCount(1);
    });

    test('should handle maximum dice count', async () => {
      // Increase to maximum (typically 6)
      for (let i = 1; i < 6; i++) {
        await diceRollerPage.increaseDiceCount();
      }
      
      // Try to increase beyond maximum
      await diceRollerPage.increaseDiceCount();
      
      // Should still be at maximum
      const count = await diceRollerPage.getCurrentDiceCount();
      expect(count).toBeLessThanOrEqual(6);
    });

    test('should handle minimum dice count', async () => {
      // Should not be able to go below 1
      await diceRollerPage.decreaseDiceCount();
      await diceRollerPage.verifyDiceCount(1);
    });
  });

  test.describe('Animation and Interaction Tests', () => {
    test('should prevent multiple simultaneous rolls', async () => {
      // Start a roll
      await diceRollerPage.rollDice();
      
      // Try to roll again immediately (should be prevented)
      await diceRollerPage.page.click('[data-testid="roll-button"]', { timeout: 1000 });
      
      // Wait for first roll to complete
      await diceRollerPage.waitForRollComplete();
      
      // Should be able to roll again now
      await diceRollerPage.rollDice();
      await diceRollerPage.waitForRollComplete();
    });

    test('should display rolling animation', async () => {
      await diceRollerPage.rollDice();
      
      // Check if roll button is disabled during animation
      const rollButton = diceRollerPage.page.locator('[data-testid="roll-button"]');
      await expect(rollButton).toBeDisabled();
      
      await diceRollerPage.waitForRollComplete();
      
      // Button should be enabled again
      await expect(rollButton).toBeEnabled();
    });
  });

  test.describe('Navigation Tests', () => {
    test('should be able to navigate back to landing', async () => {
      await diceRollerPage.navigateBack();
      
      // Should be back on landing page
      await expect(diceRollerPage.page.locator('[data-testid="uncle-header"]')).toBeVisible();
    });
  });

  test.describe('Visual Tests', () => {
    test('should display dice images correctly', async () => {
      await diceRollerPage.verifyDiceImagesVisible();
    });

    test('should display controls correctly', async () => {
      await diceRollerPage.verifyControlsVisible();
    });
  });
});
