import { Page, expect } from '@playwright/test';
import { SELECTORS, TIMEOUTS } from './test-data';
import { AppInitialization } from './app-initialization';

export class LandingPage {
  private appInit: AppInitialization;

  constructor(private page: Page) {
    this.appInit = new AppInitialization(page);
  }

  async waitForPageLoad() {
    console.log('🏠 Loading Landing Page...');
    
    // Use robust app initialization
    await this.appInit.waitForAppToLoad();
    
    // Additional landing page specific checks
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.APP_INIT });
    
    // Ensure we have the header element visible with multiple attempts
    await this.waitForUncleHeaderWithRetries();
    
    console.log('✅ Landing page fully loaded');
  }

  private async waitForUncleHeaderWithRetries(): Promise<void> {
    const maxRetries = TIMEOUTS.MAX_RETRIES;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Checking for uncle header (attempt ${attempt}/${maxRetries})`);
        
        const uncleHeader = this.page.locator('[data-testid="uncle-header"]');
        await uncleHeader.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await expect(uncleHeader).toBeVisible();
        
        console.log('✅ Uncle header found and visible');
        return;
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          // Final attempt with detailed debugging
          await this.debugPageState();
          throw new Error(`Uncle header not found after ${maxRetries} attempts`);
        }
        
        await this.page.waitForTimeout(TIMEOUTS.RETRY_DELAY);
      }
    }
  }

  private async debugPageState(): Promise<void> {
    console.log('🔍 Debugging page state...');
    
    try {
      // Check if page is loaded
      const readyState = await this.page.evaluate(() => document.readyState);
      console.log(`📄 Document ready state: ${readyState}`);
      
      // Check for any elements with testID
      const testIdElements = await this.page.locator('[data-testid]').count();
      console.log(`🏷️  Elements with data-testid found: ${testIdElements}`);
      
      // Check for uncle header specifically
      const uncleHeaderExists = await this.page.locator('[data-testid="uncle-header"]').count();
      console.log(`👨‍💼 Uncle header elements found: ${uncleHeaderExists}`);
      
      // Check for any images
      const imageCount = await this.page.locator('img').count();
      console.log(`🖼️  Images found: ${imageCount}`);
      
      // Check for TouchableOpacity elements
      const touchableCount = await this.page.locator('touchableopacity, [role="button"]').count();
      console.log(`👆 Touchable elements found: ${touchableCount}`);
      
      // Get page title and URL
      const title = await this.page.title();
      const url = this.page.url();
      console.log(`📖 Page title: ${title}`);
      console.log(`🌐 Current URL: ${url}`);
      
    } catch (debugError) {
      console.log(`❌ Debug failed: ${debugError}`);
    }
  }

  async verifyMainElementsVisible() {
    console.log('🔍 Verifying main landing elements are visible...');
    
    // Check if all main navigation elements are visible with retries
    await this.waitForElementWithRetries('[data-testid="uncle-header"]', 'Uncle Header');
    
    // Check for tool icons (using fallback selectors if testId not available)
    await this.waitForElementWithRetries('[data-testid="turn-button"]', 'Turn Button');
    await this.waitForElementWithRetries('[data-testid="team-button"]', 'Team Button');
    await this.waitForElementWithRetries('[data-testid="dice-button"]', 'Dice Button');
    await this.waitForElementWithRetries('[data-testid="timer-button"]', 'Timer Button');
    await this.waitForElementWithRetries('[data-testid="setup-button"]', 'Setup Button');
    
    console.log('✅ All main elements verified');
  }

  private async waitForElementWithRetries(selector: string, elementName: string): Promise<void> {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const element = this.page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
        await expect(element).toBeVisible();
        console.log(`✅ ${elementName} is visible`);
        return;
      } catch (error) {
        console.log(`⏳ ${elementName} not visible yet (attempt ${attempt}/${maxRetries})`);
        
        if (attempt === maxRetries) {
          // Try fallback selector based on the element type
          try {
            await this.tryFallbackSelector(selector, elementName);
            return;
          } catch {
            throw new Error(`${elementName} not found after ${maxRetries} attempts and fallback`);
          }
        }
        
        await this.page.waitForTimeout(2000);
      }
    }
  }

  private async tryFallbackSelector(selector: string, elementName: string): Promise<void> {
    console.log(`🔄 Trying fallback selector for ${elementName}...`);
    
    // Extract the test ID and try fallback strategies
    const testId = selector.match(/data-testid="([^"]+)"/)?.[1];
    
    if (testId) {
      const fallbackSelectors = [
        `[testid="${testId}"]`, // Alternative testid attribute
        `img[src*="${testId.replace('-button', '_icon')}"]`, // Image with icon name
        `touchableopacity:has(img[src*="${testId.replace('-button', '_icon')}"])`, // TouchableOpacity with image
        `[data-testid*="${testId.split('-')[0]}"]`, // Partial testid match
      ];
      
      for (const fallbackSelector of fallbackSelectors) {
        try {
          const fallbackElement = this.page.locator(fallbackSelector).first();
          await fallbackElement.waitFor({ state: 'visible', timeout: 5000 });
          await expect(fallbackElement).toBeVisible();
          console.log(`✅ ${elementName} found using fallback selector: ${fallbackSelector}`);
          return;
        } catch {
          // Continue to next fallback
        }
      }
    }
    
    throw new Error(`All fallback selectors failed for ${elementName}`);
  }

  async navigateToChat() {
    await this.appInit.navigateToPage('uncle-header', 'Chat Screen');
  }

  async navigateToTurnSelector() {
    await this.appInit.navigateToPage('turn-button', 'Turn Selector Screen');
  }

  async navigateToTeamRandomizer() {
    await this.appInit.navigateToPage('team-button', 'Team Randomizer Screen');
  }

  async navigateToDiceRoller() {
    await this.appInit.navigateToPage('dice-button', 'Dice Roller Screen');
  }

  async navigateToTimer() {
    await this.appInit.navigateToPage('timer-button', 'Timer Screen');
  }

  async verifyVersionDisplayed() {
    // Look for version text using modern Playwright selector
    const versionText = this.page.getByText('App Version');
    await expect(versionText).toBeVisible();
  }

  async verifyBackButton() {
    await expect(this.page.locator('[data-testid="back-button"]')).toBeVisible();
  }
}
