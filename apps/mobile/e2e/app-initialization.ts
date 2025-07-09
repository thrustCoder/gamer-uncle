import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from './test-data';

export class AppInitialization {
  constructor(private page: Page) {}

  /**
   * Robust app initialization check with multiple fallback strategies
   */
  async waitForAppToLoad(): Promise<void> {
    console.log('🚀 Starting app initialization check...');
    
    // Step 1: Wait for basic page load states
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log('✅ DOM content loaded');

    // Step 2: Wait for network to settle (React Native app assets loading)
    await this.page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('✅ Network idle achieved');

    // Step 3: Wait for React Native to initialize (check for any React Native indicators)
    await this.waitForReactNativeReady();
    console.log('✅ React Native ready');

    // Step 4: Wait for the main app container or any initial element
    await this.waitForMainAppContainer();
    console.log('✅ Main app container ready');

    // Step 5: Final verification that key elements are accessible
    await this.verifyKeyElementsAccessible();
    console.log('✅ Key elements verified');
  }

  private async waitForReactNativeReady(): Promise<void> {
    // Wait for React Native bridge to be ready
    // This checks for common React Native indicators
    await this.page.waitForFunction(
      () => {
        // Check if React Native global objects exist
        return (
          (window as any).ReactNativeWebView || 
          (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
          document.querySelector('[data-testid]') ||
          document.querySelector('div[id*="root"], div[id*="app"], #App')
        );
      },
      { timeout: 25000 }
    );
  }

  private async waitForMainAppContainer(): Promise<void> {
    // Wait for the main app container to be present and visible
    try {
      // First try to find the uncle header (main landing element)
      await this.page.waitForSelector('[data-testid="uncle-header"]', { 
        state: 'attached', 
        timeout: 15000 
      });
    } catch {
      // Fallback: wait for any touchable element or navigation container
      await this.page.waitForSelector(
        'touchableopacity, [role="button"], img, [data-testid], [testid]',
        { state: 'attached', timeout: 15000 }
      );
    }
  }

  private async verifyKeyElementsAccessible(): Promise<void> {
    // Final check that we can interact with the app
    const startTime = Date.now();
    const maxWaitTime = 20000; // 20 seconds max

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Try to locate the uncle header element
        const uncleHeader = this.page.locator('[data-testid="uncle-header"]');
        await uncleHeader.waitFor({ state: 'visible', timeout: 3000 });
        
        // Verify it's actually clickable
        await expect(uncleHeader).toBeVisible();
        await expect(uncleHeader).toBeEnabled();
        return; // Success!
      } catch {
        console.log('⏳ Retrying element accessibility check...');
        await this.page.waitForTimeout(2000);
      }
    }

    throw new Error('App did not become accessible within the timeout period');
  }

  /**
   * Enhanced navigation with retries and better error handling
   */
  async navigateToPage(targetTestId: string, description: string): Promise<void> {
    console.log(`🧭 Navigating to ${description}...`);
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📍 Navigation attempt ${attempt}/${maxRetries}`);
        
        // Wait for the target element to be clickable
        const element = this.page.locator(`[data-testid="${targetTestId}"]`);
        await element.waitFor({ state: 'visible', timeout: 10000 });
        await element.waitFor({ state: 'attached', timeout: 5000 });
        
        // Scroll into view if needed
        await element.scrollIntoViewIfNeeded();
        
        // Click the element
        await element.click({ timeout: 5000 });
        
        // Wait for navigation to complete
        await this.page.waitForTimeout(2000);
        
        console.log(`✅ Successfully navigated to ${description}`);
        return;
      } catch (error) {
        console.log(`❌ Navigation attempt ${attempt} failed: ${error}`);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to navigate to ${description} after ${maxRetries} attempts: ${error}`);
        }
        
        // Wait before retry
        await this.page.waitForTimeout(3000);
      }
    }
  }

  /**
   * Wait for a specific page to be loaded with enhanced checks
   */
  async waitForPageWithElement(elementTestId: string, pageName: string): Promise<void> {
    console.log(`⏳ Waiting for ${pageName} page to load...`);
    
    const maxWaitTime = TIMEOUTS.PAGE_LOAD;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const element = this.page.locator(`[data-testid="${elementTestId}"]`);
        await element.waitFor({ state: 'visible', timeout: 3000 });
        await expect(element).toBeVisible();
        console.log(`✅ ${pageName} page loaded successfully`);
        return;
      } catch {
        console.log(`⏳ Still waiting for ${pageName} page...`);
        await this.page.waitForTimeout(2000);
      }
    }

    throw new Error(`${pageName} page did not load within ${maxWaitTime}ms`);
  }
}