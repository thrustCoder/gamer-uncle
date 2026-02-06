import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';
import { TIMEOUTS } from './test-data';

test.describe('Timer Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    // Initialize app and navigate to Timer
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Timer',
      '[data-testid="timer-button"]',
      '[data-testid="timer-screen"], [data-testid="timer-display"]'
    );
  });

  test('should display Timer screen', async ({ page }) => {
    const timerScreen = page.locator('[data-testid="timer-screen"]');
    await expect(timerScreen).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('should display timer at 00:00 initially', async ({ page }) => {
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    await expect(timerDisplay).toBeVisible();
    await expect(timerDisplay).toHaveText('00:00');
  });

  test('should display preset buttons', async ({ page }) => {
    // Check for all preset buttons
    await expect(page.locator('[data-testid="preset-10s"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-30s"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-1m"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-5m"]')).toBeVisible();
  });

  test('should update timer when 10s preset is clicked', async ({ page }) => {
    // Click 10s preset
    await page.locator('[data-testid="preset-10s"]').click();
    
    // Timer should show 00:10
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    await expect(timerDisplay).toHaveText('00:10');
  });

  test('should update timer when 30s preset is clicked', async ({ page }) => {
    // Click 30s preset
    await page.locator('[data-testid="preset-30s"]').click();
    
    // Timer should show 00:30
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    await expect(timerDisplay).toHaveText('00:30');
  });

  test('should update timer when 1m preset is clicked', async ({ page }) => {
    // Click 1m preset
    await page.locator('[data-testid="preset-1m"]').click();
    
    // Timer should show 01:00
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    await expect(timerDisplay).toHaveText('01:00');
  });

  test('should update timer when 5m preset is clicked', async ({ page }) => {
    // Click 5m preset
    await page.locator('[data-testid="preset-5m"]').click();
    
    // Timer should show 05:00
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    await expect(timerDisplay).toHaveText('05:00');
  });

  test('should accumulate time from multiple presets', async ({ page }) => {
    // Click 30s preset
    await page.locator('[data-testid="preset-30s"]').click();
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('00:30');
    
    // Click 1m preset to add more time
    await page.locator('[data-testid="preset-1m"]').click();
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('01:30');
  });

  test('should show START button after selecting preset', async ({ page }) => {
    // Initially no start button
    const startButton = page.locator('[data-testid="start-timer"]');
    await expect(startButton).not.toBeVisible();
    
    // Click preset
    await page.locator('[data-testid="preset-10s"]').click();
    
    // Start button should appear
    await expect(startButton).toBeVisible();
  });

  test('should show RESET button after selecting preset', async ({ page }) => {
    // Click preset
    await page.locator('[data-testid="preset-10s"]').click();
    
    // Reset button should appear
    const resetButton = page.locator('[data-testid="reset-timer"]');
    await expect(resetButton).toBeVisible();
  });

  test('should show PAUSE button after starting', async ({ page }) => {
    // Setup and start timer
    await page.locator('[data-testid="preset-10s"]').click();
    await page.locator('[data-testid="start-timer"]').click();
    
    // Pause button should be visible
    const pauseButton = page.locator('[data-testid="pause-timer"]');
    await expect(pauseButton).toBeVisible();
  });

  test('should hide START button after starting', async ({ page }) => {
    // Setup and start timer
    await page.locator('[data-testid="preset-10s"]').click();
    await page.locator('[data-testid="start-timer"]').click();
    
    // Start button should be hidden
    const startButton = page.locator('[data-testid="start-timer"]');
    await expect(startButton).not.toBeVisible();
  });

  test('should show RESUME button after pausing', async ({ page }) => {
    // Setup, start, and pause timer
    await page.locator('[data-testid="preset-10s"]').click();
    await page.locator('[data-testid="start-timer"]').click();
    await page.locator('[data-testid="pause-timer"]').click();
    
    // Resume button should be visible
    const resumeButton = page.locator('[data-testid="resume-timer"]');
    await expect(resumeButton).toBeVisible();
  });

  test('should reset timer to 00:00 when reset is clicked', async ({ page }) => {
    // Setup timer
    await page.locator('[data-testid="preset-30s"]').click();
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('00:30');
    
    // Reset timer
    await page.locator('[data-testid="reset-timer"]').click();
    
    // Timer should be back to 00:00
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('00:00');
  });

  test('should countdown when running', async ({ page }) => {
    // Setup and start timer with 10 seconds
    await page.locator('[data-testid="preset-10s"]').click();
    await page.locator('[data-testid="start-timer"]').click();
    
    // Wait for 2 seconds
    await page.waitForTimeout(2500);
    
    // Timer should have counted down (should be less than 10)
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    const text = await timerDisplay.textContent();
    
    // Parse the time - should be less than 00:10
    const [minutes, seconds] = text!.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;
    
    expect(totalSeconds).toBeLessThan(10);
    expect(totalSeconds).toBeGreaterThanOrEqual(7); // Should be around 7-8 seconds
  });

  test('should have back button visible', async ({ page }) => {
    const backButton = page.locator('[data-testid="back-button"]');
    await expect(backButton).toBeVisible();
  });

  test('should navigate back to landing when back button is clicked', async ({ page }) => {
    // Click back button
    const backButton = page.locator('[data-testid="back-button"]');
    await backButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(TIMEOUTS.NAVIGATION);
    
    // Should be back on landing page
    const landingIndicator = page.locator('[data-testid="center-circle"], [data-testid="uncle-header"]');
    await expect(landingIndicator.first()).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });
});

test.describe('Timer Screen - Edge Cases', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);
    
    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Timer',
      '[data-testid="timer-button"]',
      '[data-testid="timer-screen"], [data-testid="timer-display"]'
    );
  });

  test('should disable preset buttons while timer is running', async ({ page }) => {
    // Setup and start timer
    await page.locator('[data-testid="preset-10s"]').click();
    await page.locator('[data-testid="start-timer"]').click();
    
    // Preset buttons should be disabled
    const preset30s = page.locator('[data-testid="preset-30s"]');
    await expect(preset30s).toBeDisabled();
  });

  test('should pause and maintain time correctly', async ({ page }) => {
    // Setup and start timer
    await page.locator('[data-testid="preset-10s"]').click();
    await page.locator('[data-testid="start-timer"]').click();
    
    // Wait for 1 second
    await page.waitForTimeout(1500);
    
    // Pause timer
    await page.locator('[data-testid="pause-timer"]').click();
    
    // Get current time
    const timeAfterPause = await page.locator('[data-testid="timer-display"]').textContent();
    
    // Wait another 2 seconds
    await page.waitForTimeout(2000);
    
    // Time should not have changed while paused
    const timeAfterWait = await page.locator('[data-testid="timer-display"]').textContent();
    expect(timeAfterWait).toBe(timeAfterPause);
  });
});
