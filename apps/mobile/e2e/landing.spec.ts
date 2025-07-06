import { test, expect } from '@playwright/test';
import { LandingPage } from './landing-page';

test.describe('Landing Screen E2E Tests', () => {
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    await page.goto('/');
    await landingPage.waitForPageLoad();
  });

  test.describe('Navigation Tests', () => {
    test('should display all navigation elements', async () => {
      // Check if all main elements are visible
      await landingPage.verifyMainElementsVisible();
    });

    test('should navigate to Chat screen when uncle header is clicked', async () => {
      await landingPage.navigateToChat();
      
      // Verify we're on the chat screen
      await expect(landingPage.page.locator('[data-testid="chat-input"]')).toBeVisible();
    });

    test('should navigate to Turn Selector screen', async () => {
      await landingPage.navigateToTurnSelector();
      
      // Verify we're on the turn selector screen
      await expect(landingPage.page.locator('[data-testid="turn-selector"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Team Randomizer screen', async () => {
      await landingPage.navigateToTeamRandomizer();
      
      // Verify we're on the team randomizer screen
      await expect(landingPage.page.locator('[data-testid="team-randomizer"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Dice Roller screen', async () => {
      await landingPage.navigateToDiceRoller();
      
      // Verify we're on the dice roller screen
      await expect(landingPage.page.locator('[data-testid="dice-roller"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Timer screen', async () => {
      await landingPage.navigateToTimer();
      
      // Verify we're on the timer screen
      await expect(landingPage.page.locator('[data-testid="timer-screen"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Visual Tests', () => {
    test('should display version information', async () => {
      await landingPage.verifyVersionDisplayed();
    });

    test('should have proper layout and styling', async () => {
      // Verify the background and layout elements are present
      const imageCount = await landingPage.page.locator('img').count();
      expect(imageCount).toBeGreaterThanOrEqual(5); // Uncle header + 4 tool icons (may have additional images)
    });
  });

  test.describe('Back Navigation Tests', () => {
    test('should be able to navigate back from each screen', async () => {
      const screens = ['Chat', 'Turn', 'Team', 'Dice', 'Timer'];
      
      for (const screen of screens) {
        // Navigate to the screen
        switch (screen) {
          case 'Chat':
            await landingPage.navigateToChat();
            break;
          case 'Turn':
            await landingPage.navigateToTurnSelector();
            break;
          case 'Team':
            await landingPage.navigateToTeamRandomizer();
            break;
          case 'Dice':
            await landingPage.navigateToDiceRoller();
            break;
          case 'Timer':
            await landingPage.navigateToTimer();
            break;
        }
        
        // Navigate back
        await landingPage.page.click('[data-testid="back-button"]', { timeout: 10000 });
        
        // Verify we're back on the landing screen
        await landingPage.waitForPageLoad();
        await landingPage.verifyMainElementsVisible();
      }
    });
  });
});
