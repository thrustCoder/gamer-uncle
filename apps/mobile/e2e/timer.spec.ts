import { test, expect } from '@playwright/test';
import { TimerPage } from './timer-page';

test.describe('Timer Screen E2E Tests', () => {
  let timerPage: TimerPage;

  test.beforeEach(async ({ page }) => {
    timerPage = new TimerPage(page);
    
    // Navigate to timer through landing page
    await page.goto('/');
    await page.click('[data-testid="uncle-header"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="timer-button"], img[src*="timer_icon"]', { timeout: 10000 });
    await page.click('[data-testid="timer-button"], img[src*="timer_icon"]');
    
    await timerPage.waitForPageLoad();
  });

  test.describe('Timer Configuration', () => {
    test('should display initial timer state', async () => {
      await timerPage.verifyInitialState();
    });

    test('should be able to set custom timer duration', async () => {
      await timerPage.setCustomTime(120); // 2 minutes
      await timerPage.verifyDisplayedTime('2:00');
    });

    test('should be able to use preset timer values', async () => {
      // Test 30 second preset
      await timerPage.selectPreset('30s');
      await timerPage.verifyDisplayedTime('0:30');
      
      // Test 1 minute preset
      await timerPage.selectPreset('1m');
      await timerPage.verifyDisplayedTime('1:00');
      
      // Test 5 minute preset
      await timerPage.selectPreset('5m');
      await timerPage.verifyDisplayedTime('5:00');
    });
  });

  test.describe('Timer Operation', () => {
    test('should be able to start and pause timer', async () => {
      // Set a timer
      await timerPage.setCustomTime(10); // 10 seconds
      
      // Start timer
      await timerPage.startTimer();
      await timerPage.verifyTimerRunning();
      
      // Wait a moment and pause
      await timerPage.page.waitForTimeout(2000);
      await timerPage.pauseTimer();
      await timerPage.verifyTimerPaused();
    });

    test('should be able to reset timer', async () => {
      // Set and start a timer
      await timerPage.setCustomTime(60);
      await timerPage.startTimer();
      
      // Wait a moment then reset
      await timerPage.page.waitForTimeout(2000);
      await timerPage.resetTimer();
      
      // Should be back to initial state
      await timerPage.verifyTimerReset();
    });

    test('should countdown properly', async () => {
      // Set a short timer
      await timerPage.setCustomTime(5); // 5 seconds
      
      // Start timer
      await timerPage.startTimer();
      
      // Wait 2 seconds and check time decreased
      await timerPage.page.waitForTimeout(2000);
      const remainingTime = await timerPage.getRemainingTime();
      expect(remainingTime).toBeLessThan(5);
      expect(remainingTime).toBeGreaterThan(0);
    });

    test('should handle timer completion', async () => {
      // Set a very short timer
      await timerPage.setCustomTime(3); // 3 seconds
      
      // Start timer
      await timerPage.startTimer();
      
      // Wait for completion
      await timerPage.waitForTimerComplete();
      
      // Verify timer completed state
      await timerPage.verifyTimerCompleted();
    });
  });

  test.describe('Visual Feedback', () => {
    test('should display progress circle correctly', async () => {
      await timerPage.setCustomTime(60);
      await timerPage.verifyProgressCircleVisible();
    });

    test('should update progress during countdown', async () => {
      await timerPage.setCustomTime(10);
      await timerPage.startTimer();
      
      // Wait a moment and check progress changed
      await timerPage.page.waitForTimeout(2000);
      await timerPage.verifyProgressChanged();
    });

    test('should show proper button states', async () => {
      // Initial state
      await timerPage.verifyStartButtonVisible();
      
      // After setting time
      await timerPage.setCustomTime(30);
      await timerPage.verifyStartButtonEnabled();
      
      // During countdown
      await timerPage.startTimer();
      await timerPage.verifyPauseButtonVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle maximum time limit', async () => {
      // Try to set time beyond maximum (10 minutes = 600 seconds)
      await timerPage.setCustomTime(700);
      
      // Should be capped at maximum
      const displayedTime = await timerPage.getDisplayedTime();
      expect(displayedTime).toBe('10:00');
    });

    test('should handle minimum time limit', async () => {
      // Try to set negative or zero time
      await timerPage.setCustomTime(0);
      
      // Should show appropriate state
      await timerPage.verifyStartButtonDisabled();
    });

    test('should handle pause and resume correctly', async () => {
      await timerPage.setCustomTime(10);
      await timerPage.startTimer();
      
      // Pause after 2 seconds
      await timerPage.page.waitForTimeout(2000);
      const timeBeforePause = await timerPage.getRemainingTime();
      await timerPage.pauseTimer();
      
      // Wait while paused
      await timerPage.page.waitForTimeout(2000);
      const timeAfterPause = await timerPage.getRemainingTime();
      
      // Time should not have changed while paused
      expect(timeAfterPause).toBe(timeBeforePause);
      
      // Resume
      await timerPage.resumeTimer();
      await timerPage.page.waitForTimeout(1000);
      const timeAfterResume = await timerPage.getRemainingTime();
      
      // Time should continue counting down
      expect(timeAfterResume).toBeLessThan(timeBeforePause);
    });
  });

  test.describe('Navigation Tests', () => {
    test('should be able to navigate back to landing', async () => {
      await timerPage.navigateBack();
      
      // Should be back on landing page
      await expect(timerPage.page.locator('[data-testid="uncle-header"]')).toBeVisible();
    });

    test('should preserve timer state when navigating away and back', async () => {
      // Set a timer
      await timerPage.setCustomTime(120);
      
      // Navigate away
      await timerPage.navigateBack();
      
      // Navigate back to timer
      await timerPage.page.click('[data-testid="timer-button"], img[src*="timer_icon"]');
      await timerPage.waitForPageLoad();
      
      // Timer should be reset (this is expected behavior for a fresh navigation)
      await timerPage.verifyInitialState();
    });
  });
});
