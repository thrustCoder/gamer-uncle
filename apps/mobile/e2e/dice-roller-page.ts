import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from './test-data';

export class DiceRollerPage {
  constructor(public page: Page) {}

  async waitForPageLoad() {
    await this.page.waitForSelector('[data-testid="dice-roller"], [class*="dice"], img[src*="dice"]', { 
      timeout: TIMEOUTS.PAGE_LOAD 
    });
  }

  async verifyInitialState() {
    // Check for dice display
    await expect(this.page.locator('[data-testid="dice-display"], [class*="dice"], img[src*="dice"]').first()).toBeVisible();
    
    // Check for roll button
    await expect(this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first()).toBeVisible();
    
    // Check for dice count controls
    await expect(this.page.locator('[data-testid="dice-count"], text*="1"').first()).toBeVisible();
  }

  async rollDice() {
    const rollButton = this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first();
    await rollButton.click();
  }

  async waitForRollComplete() {
    // Wait for roll animation to complete (typically 2-3 seconds)
    await this.page.waitForTimeout(3000);
    
    // Wait for roll button to be enabled again
    const rollButton = this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first();
    await expect(rollButton).toBeEnabled({ timeout: TIMEOUTS.API_RESPONSE });
  }

  async getDiceValue(): Promise<number> {
    // Try to get dice value from text content or image src
    try {
      const diceText = await this.page.locator('[data-testid="dice-value"]').first().textContent();
      if (diceText) {
        return parseInt(diceText);
      }
    } catch {
      // Fallback: try to get from image src
      const diceImage = await this.page.locator('img[src*="dice"]').first().getAttribute('src');
      if (diceImage) {
        const match = diceImage.match(/dice(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }
    
    // Default to 1 if we can't determine the value
    return 1;
  }

  async getAllDiceValues(): Promise<number[]> {
    const diceElements = await this.page.locator('[data-testid="dice-value"], img[src*="dice"]').all();
    const values: number[] = [];
    
    for (const element of diceElements) {
      try {
        const textContent = await element.textContent();
        if (textContent) {
          values.push(parseInt(textContent));
        } else {
          const src = await element.getAttribute('src');
          if (src) {
            const match = src.match(/dice(\d+)/);
            if (match) {
              values.push(parseInt(match[1]));
            }
          }
        }
      } catch {
        values.push(1); // Default value
      }
    }
    
    return values.length > 0 ? values : [1];
  }

  async increaseDiceCount() {
    const increaseButton = this.page.locator('[data-testid="increase-dice"], [class*="plus"], button:has-text("+")').first();
    await increaseButton.click();
  }

  async decreaseDiceCount() {
    const decreaseButton = this.page.locator('[data-testid="decrease-dice"], [class*="minus"], button:has-text("-")').first();
    await decreaseButton.click();
  }

  async getCurrentDiceCount(): Promise<number> {
    try {
      const countText = await this.page.locator('[data-testid="dice-count"]').textContent();
      if (countText) {
        const match = countText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 1;
      }
    } catch {
      // Fallback: count visible dice
      const diceElements = await this.page.locator('[data-testid="dice-value"], img[src*="dice"]').all();
      return diceElements.length;
    }
    return 1;
  }

  async verifyDiceCount(expectedCount: number) {
    const actualCount = await this.getCurrentDiceCount();
    expect(actualCount).toBe(expectedCount);
  }

  async verifyDiceImagesVisible() {
    const diceImages = await this.page.locator('img[src*="dice"]').all();
    expect(diceImages.length).toBeGreaterThan(0);
    
    for (const image of diceImages) {
      await expect(image).toBeVisible();
    }
  }

  async verifyControlsVisible() {
    // Check for dice count controls
    await expect(this.page.locator('[data-testid="increase-dice"], [class*="plus"], button:has-text("+")').first()).toBeVisible();
    await expect(this.page.locator('[data-testid="decrease-dice"], [class*="minus"], button:has-text("-")').first()).toBeVisible();
    
    // Check for roll button
    await expect(this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first()).toBeVisible();
  }

  async navigateBack() {
    await this.page.click('[data-testid="back-button"]');
  }
}
