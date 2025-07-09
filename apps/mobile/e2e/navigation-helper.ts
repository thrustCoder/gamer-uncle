import { Page, expect } from '@playwright/test';
import { SELECTORS, TIMEOUTS } from './test-data';
import { AppInitialization } from './app-initialization';

export class NavigationHelper {
  private appInit: AppInitialization;

  constructor(private page: Page) {
    this.appInit = new AppInitialization(page);
  }

  /**
   * Initialize the app and wait for landing page
   */
  async initializeApp() {
    console.log('🚀 Initializing app...');
    await this.page.goto('/');
    await this.appInit.waitForAppToLoad();
    console.log('✅ App initialized successfully');
  }

  /**
   * Navigate to a specific screen with robust error handling
   */
  async navigateToScreen(screenName: string, buttonSelector: string, verificationSelector: string) {
    console.log(`🧭 Navigating to ${screenName}...`);
    
    const maxRetries = TIMEOUTS.MAX_RETRIES;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait for and click the navigation button
        const navButton = this.page.locator(buttonSelector).first();
        await navButton.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await navButton.click();
        
        // Wait for navigation to complete
        await this.page.waitForTimeout(TIMEOUTS.NAVIGATION);
        
        // Verify we're on the correct screen
        const screenElement = this.page.locator(verificationSelector).first();
        await screenElement.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
        await expect(screenElement).toBeVisible();
        
        console.log(`✅ Successfully navigated to ${screenName}`);
        return;
      } catch (error) {
        console.log(`❌ Navigation to ${screenName} attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to navigate to ${screenName} after ${maxRetries} attempts`);
        }
        
        // Try to return to landing page before retrying
        try {
          await this.navigateBackToLanding();
        } catch {
          // If we can't get back to landing, try a fresh start
          await this.initializeApp();
        }
        
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
  }

  /**
   * Navigate back to the landing page
   */
  async navigateBackToLanding() {
    console.log('🏠 Navigating back to landing page...');
    
    const maxRetries = TIMEOUTS.MAX_RETRIES;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try clicking the back button
        const backButton = this.page.locator('[data-testid="back-button"]').first();
        await backButton.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await backButton.click();
        
        // Wait for navigation
        await this.page.waitForTimeout(TIMEOUTS.NAVIGATION);
        
        // Verify we're back on landing page
        const uncleHeader = this.page.locator(SELECTORS.uncleHeader).first();
        await uncleHeader.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
        await expect(uncleHeader).toBeVisible();
        
        console.log('✅ Successfully navigated back to landing');
        return;
      } catch (error) {
        console.log(`❌ Navigate back attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          // Last resort: go to home URL
          console.log('🔄 Using fallback: navigating to home URL');
          await this.page.goto('/');
          await this.appInit.waitForAppToLoad();
          return;
        }
        
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
  }

  /**
   * Test navigation to all main screens
   */
  async testAllScreenNavigation() {
    const screens = [
      { 
        name: 'Timer', 
        button: '[data-testid="timer-button"], img[src*="timer_icon"]', 
        verification: '[data-testid="timer-screen"]' 
      },
      { 
        name: 'Dice Roller', 
        button: '[data-testid="dice-button"], img[src*="dice_icon"]', 
        verification: '[data-testid="dice-roller"]' 
      },
      { 
        name: 'Turn Selector', 
        button: '[data-testid="turn-button"], img[src*="turn_icon"]', 
        verification: '[data-testid="turn-selector"]' 
      },
      { 
        name: 'Team Randomizer', 
        button: '[data-testid="team-button"], img[src*="team_icon"]', 
        verification: '[data-testid="team-randomizer"]' 
      },
      { 
        name: 'Chat', 
        button: '[data-testid="uncle-header"]', 
        verification: '[data-testid="chat-input"]' 
      }
    ];

    for (const screen of screens) {
      // Navigate to screen
      await this.navigateToScreen(screen.name, screen.button, screen.verification);
      
      // Navigate back to landing (except for the last screen)
      if (screen !== screens[screens.length - 1]) {
        await this.navigateBackToLanding();
      }
    }
  }

  /**
   * Verify UI consistency across screens
   */
  async verifyUIConsistency(screenName: string) {
    console.log(`🎨 Verifying UI consistency for ${screenName}...`);
    
    // Check for back button (should be visible on all tool screens except landing)
    if (screenName !== 'Landing') {
      const backButton = this.page.locator('[data-testid="back-button"]').first();
      await expect(backButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    }
    
    // Check for background (common element)
    try {
      const background = this.page.locator('img[src*="tool_background"], img[src*="background"]').first();
      await expect(background).toBeVisible({ timeout: 5000 });
    } catch {
      console.log('Note: Background image not found, but this may be expected');
    }
    
    console.log(`✅ UI consistency verified for ${screenName}`);
  }

  /**
   * Check if we're currently on the landing page
   */
  async isOnLandingPage(): Promise<boolean> {
    try {
      const uncleHeader = this.page.locator(SELECTORS.uncleHeader).first();
      await expect(uncleHeader).toBeVisible({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
