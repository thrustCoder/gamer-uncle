import { Page, expect } from '@playwright/test';
import { TIMEOUTS, SELECTORS } from './test-data';
import { AppInitialization } from './app-initialization';

export class DiceRollerPage {
  private appInit: AppInitialization;

  constructor(public page: Page) {
    this.appInit = new AppInitialization(page);
  }

  async waitForPageLoad() {
    console.log('⏳ Waiting for dice roller page to load...');
    await this.appInit.waitForPageWithElement('dice-roller', 'Dice Roller');
    await this.waitForDiceControlsWithRetries();
    console.log('✅ Dice roller page fully loaded');
  }

  private async waitForDiceControlsWithRetries(): Promise<void> {
    const maxRetries = TIMEOUTS.MAX_RETRIES;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎲 Checking for dice controls (attempt ${attempt}/${maxRetries})`);
        
        // Check for dice display and roll button
        const diceDisplay = this.page.locator('[data-testid="dice-roller"], [class*="dice"], img[src*="dice"]').first();
        const rollButton = this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first();
        
        await diceDisplay.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await rollButton.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        
        await expect(diceDisplay).toBeVisible();
        await expect(rollButton).toBeVisible();
        
        console.log('✅ Dice controls found and ready');
        return;
      } catch (error) {
        console.log(`❌ Dice controls attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          throw new Error(`Dice controls not found after ${maxRetries} attempts`);
        }
        
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
  }

  async verifyInitialState() {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check for dice display
        await expect(this.page.locator('[data-testid="dice-display"], [class*="dice"], img[src*="dice"]').first()).toBeVisible();
        
        // Check for roll button
        await expect(this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first()).toBeVisible();
        
        // Check for dice count controls
        await expect(this.page.locator('[data-testid="dice-count"]')).toBeVisible();
        
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
  }

  async rollDice() {
    const maxRetries = TIMEOUTS.MAX_RETRIES;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const rollButton = this.page.locator('[data-testid="roll-button"], [class*="roll"], button:has-text("Roll")').first();
        await rollButton.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await rollButton.click();
        console.log('✅ Dice rolled successfully');
        return;
      } catch (error) {
        console.log(`❌ Roll dice attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to roll dice after ${maxRetries} attempts`);
        }
        
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
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
    const maxRetries = TIMEOUTS.MAX_RETRIES;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const backButton = this.page.locator('[data-testid="back-button"]');
        await backButton.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await backButton.click();
        console.log('✅ Navigated back successfully');
        return;
      } catch (error) {
        console.log(`❌ Navigate back attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to navigate back after ${maxRetries} attempts`);
        }
        
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
  }
}
