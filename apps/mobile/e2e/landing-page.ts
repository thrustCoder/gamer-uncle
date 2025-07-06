import { Page, expect } from '@playwright/test';
import { SELECTORS, TIMEOUTS } from './test-data';

export class LandingPage {
  constructor(private page: Page) {}

  async waitForPageLoad() {
    // Wait for the main landing screen elements to load
    await this.page.waitForSelector('[data-testid="uncle-header"]', { timeout: TIMEOUTS.PAGE_LOAD });
    // Ensure we have a unique element by waiting for visibility
    await this.page.locator('[data-testid="uncle-header"]').first().waitFor({ state: 'visible' });
  }

  async verifyMainElementsVisible() {
    // Check if all main navigation elements are visible
    await expect(this.page.locator('[data-testid="uncle-header"]')).toBeVisible();
    
    // Check for tool icons (using fallback selectors if testId not available)
    const turnButton = this.page.locator('[data-testid="turn-button"], img[src*="turn_icon"]').first();
    const teamButton = this.page.locator('[data-testid="team-button"], img[src*="team_icon"]').first();
    const diceButton = this.page.locator('[data-testid="dice-button"], img[src*="dice_icon"]').first();
    const timerButton = this.page.locator('[data-testid="timer-button"], img[src*="timer_icon"]').first();

    await expect(turnButton).toBeVisible();
    await expect(teamButton).toBeVisible();
    await expect(diceButton).toBeVisible();
    await expect(timerButton).toBeVisible();
  }

  async navigateToChat() {
    await this.page.click('[data-testid="uncle-header"]');
    // Wait a moment for navigation
    await this.page.waitForTimeout(1000);
  }

  async navigateToTurnSelector() {
    const turnButton = this.page.locator('[data-testid="turn-button"], img[src*="turn_icon"]').first();
    await turnButton.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToTeamRandomizer() {
    const teamButton = this.page.locator('[data-testid="team-button"], img[src*="team_icon"]').first();
    await teamButton.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToDiceRoller() {
    const diceButton = this.page.locator('[data-testid="dice-button"], img[src*="dice_icon"]').first();
    await diceButton.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToTimer() {
    const timerButton = this.page.locator('[data-testid="timer-button"], img[src*="timer_icon"]').first();
    await timerButton.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyVersionDisplayed() {
    // Look for version text
    const versionText = this.page.locator('text*="App Version"');
    await expect(versionText).toBeVisible();
  }

  async verifyBackButton() {
    await expect(this.page.locator('[data-testid="back-button"]')).toBeVisible();
  }
}
