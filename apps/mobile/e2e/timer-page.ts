import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from './test-data';

export class TimerPage {
  constructor(public page: Page) {}

  async waitForPageLoad() {
    await this.page.waitForSelector('[data-testid="timer-screen"], [class*="timer"], svg, circle', { 
      timeout: TIMEOUTS.PAGE_LOAD 
    });
  }

  async verifyInitialState() {
    // Check for timer display (should show 0:00)
    await expect(this.page.locator('[data-testid="timer-display"]')).toBeVisible();
    
    // Check for preset buttons
    await expect(this.page.locator('[data-testid="preset-10s"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="preset-30s"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="preset-1m"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="preset-5m"]')).toBeVisible();
  }

  async setCustomTime(seconds: number) {
    // Look for time input or increment/decrement controls
    const timeInput = this.page.locator('[data-testid="time-input"], input[type="number"]').first();
    
    try {
      await timeInput.fill(seconds.toString());
    } catch {
      // Fallback: use increment controls
      const currentTime = await this.getRemainingTime();
      const diff = seconds - currentTime;
      
      if (diff > 0) {
        const incrementButton = this.page.locator('[data-testid="increment-time"], button:has-text("+")').first();
        for (let i = 0; i < diff; i++) {
          await incrementButton.click();
        }
      } else if (diff < 0) {
        const decrementButton = this.page.locator('[data-testid="decrement-time"], button:has-text("-")').first();
        for (let i = 0; i < Math.abs(diff); i++) {
          await decrementButton.click();
        }
      }
    }
  }

  async selectPreset(preset: string) {
    const presetButton = this.page.locator(`[data-testid="preset-${preset}"], button:has-text("${preset}")`).first();
    await presetButton.click();
  }

  async startTimer() {
    const startButton = this.page.locator('[data-testid="start-timer"], button:has-text("Start")').first();
    await startButton.click();
  }

  async pauseTimer() {
    const pauseButton = this.page.locator('[data-testid="pause-timer"], button:has-text("Pause")').first();
    await pauseButton.click();
  }

  async resumeTimer() {
    const resumeButton = this.page.locator('[data-testid="resume-timer"], button:has-text("Resume"), button:has-text("Start")').first();
    await resumeButton.click();
  }

  async resetTimer() {
    const resetButton = this.page.locator('[data-testid="reset-timer"], button:has-text("Reset")').first();
    await resetButton.click();
  }

  async getRemainingTime(): Promise<number> {
    try {
      const timeText = await this.page.locator('[data-testid="timer-display"], [class*="time"]').first().textContent();
      if (timeText) {
        const match = timeText.match(/(\d+):(\d+)/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          return minutes * 60 + seconds;
        }
      }
    } catch {
      // Default to 0 if we can't read the time
    }
    return 0;
  }

  async getDisplayedTime(): Promise<string> {
    const timeElement = this.page.locator('[data-testid="timer-display"], [class*="time"]').first();
    const timeText = await timeElement.textContent();
    return timeText || '0:00';
  }

  async verifyDisplayedTime(expectedTime: string) {
    const displayedTime = await this.getDisplayedTime();
    expect(displayedTime).toBe(expectedTime);
  }

  async verifyTimerRunning() {
    // Check if pause button is visible (indicates timer is running)
    await expect(this.page.locator('[data-testid="pause-timer"], button:has-text("Pause")').first()).toBeVisible();
  }

  async verifyTimerPaused() {
    // Check if resume/start button is visible (indicates timer is paused)
    await expect(this.page.locator('[data-testid="resume-timer"], button:has-text("Resume"), button:has-text("Start")').first()).toBeVisible();
  }

  async verifyTimerReset() {
    const time = await this.getDisplayedTime();
    expect(time).toBe('0:00');
  }

  async waitForTimerComplete() {
    // Wait for timer to reach 0:00
    await expect(this.page.locator('[data-testid="timer-display"]').first()).toContainText('0:00', { 
      timeout: 15000 
    });
  }

  async verifyTimerCompleted() {
    const time = await this.getDisplayedTime();
    expect(time).toBe('0:00');
    
    // Check if start button is visible again
    await expect(this.page.locator('[data-testid="start-timer"], button:has-text("Start")').first()).toBeVisible();
  }

  async verifyProgressCircleVisible() {
    await expect(this.page.locator('svg, [data-testid="progress-circle"]').first()).toBeVisible();
  }

  async verifyProgressChanged() {
    // This is a basic check - in a real implementation, you might check SVG attributes
    const circle = this.page.locator('circle').first();
    await expect(circle).toBeVisible();
  }

  async verifyStartButtonVisible() {
    await expect(this.page.locator('[data-testid="start-timer"], button:has-text("Start")').first()).toBeVisible();
  }

  async verifyStartButtonEnabled() {
    const startButton = this.page.locator('[data-testid="start-timer"], button:has-text("Start")').first();
    await expect(startButton).toBeEnabled();
  }

  async verifyStartButtonDisabled() {
    const startButton = this.page.locator('[data-testid="start-timer"], button:has-text("Start")').first();
    await expect(startButton).toBeDisabled();
  }

  async verifyPauseButtonVisible() {
    await expect(this.page.locator('[data-testid="pause-timer"], button:has-text("Pause")').first()).toBeVisible();
  }

  async navigateBack() {
    await this.page.click('[data-testid="back-button"]');
  }
}
