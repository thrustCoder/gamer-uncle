import { test, expect } from '@playwright/test';
import { AppInitialization } from './app-initialization';
import { NavigationHelper } from './navigation-helper';
import { TIMEOUTS } from './test-data';

/**
 * E2E coverage for the Track Turns screen.
 *
 * The screen is reachable from Landing via the `turn` feature button
 * (icon: refresh-circle) which routes to the `TurnTracker` stack screen.
 * These tests exercise the setup-mode flow (seating, picker modal,
 * Begin Game disabled state, back navigation) and stop short of the
 * in-game lifecycle to keep the spec deterministic on web (Alert.alert
 * doesn't render in web builds the same way it does on iOS/Android).
 */
test.describe('Track Turns Screen', () => {
  let appInit: AppInitialization;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    appInit = new AppInitialization(page);
    navHelper = new NavigationHelper(page);

    await page.goto('/');
    await appInit.waitForAppToLoad();
    await navHelper.navigateToScreen(
      'Track Turns',
      '[data-testid="turn-button"]',
      '[data-testid="turn-tracker-screen"]'
    );
  });

  test('renders the Track Turns header and the setup view', async ({ page }) => {
    await expect(page.locator('[data-testid="turn-tracker-screen"]')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
    await expect(page.getByText('Track Turns', { exact: true })).toBeVisible();
    // Seating circle is rendered when the active roster has 2–20 players.
    await expect(page.locator('[data-testid="seating-circle"]')).toBeVisible();
  });

  test('shows the Pick First Turn CTA when no seats are filled', async ({ page }) => {
    await expect(page.locator('[data-testid="cta-pick-turn"]')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('Begin Game button is rendered but disabled before any seat is assigned', async ({ page }) => {
    const beginBtn = page.locator('[data-testid="begin-game-button"]');
    await expect(beginBtn).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    // React Native Web mirrors `disabled` onto the underlying element when
    // accessibilityState.disabled is true.
    await expect(beginBtn).toBeDisabled();
  });

  test('tapping a seat opens the player picker modal', async ({ page }) => {
    // First seat (zero-indexed 0). The seating circle renders one tap target per player.
    const seatTouch = page.locator('[data-testid="seat-0-touch"]').first();
    await expect(seatTouch).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await seatTouch.click();

    // Modal shows the cancel button and at least one player row.
    await expect(page.locator('[data-testid="player-picker-cancel"]')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
    await expect(page.locator('[data-testid="player-picker-row-0"]')).toBeVisible();
  });

  test('Cancel in the player picker closes the modal without assigning a player', async ({ page }) => {
    await page.locator('[data-testid="seat-0-touch"]').first().click();
    await expect(page.locator('[data-testid="player-picker-cancel"]')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });

    await page.locator('[data-testid="player-picker-cancel"]').click();

    // Modal is gone; the Pick First Turn CTA is still showing because no seat was filled.
    await expect(page.locator('[data-testid="player-picker-cancel"]')).toBeHidden();
    await expect(page.locator('[data-testid="cta-pick-turn"]')).toBeVisible();
  });

  test('selecting a player from the picker assigns them to the seat', async ({ page }) => {
    await page.locator('[data-testid="seat-0-touch"]').first().click();
    await expect(page.locator('[data-testid="player-picker-row-1"]')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });

    // Pick the second player (index 1).
    await page.locator('[data-testid="player-picker-row-1"]').click();

    // Picker closes, and the Pick First Turn CTA disappears once any seat is filled.
    await expect(page.locator('[data-testid="player-picker-cancel"]')).toBeHidden();
    await expect(page.locator('[data-testid="cta-pick-turn"]')).toBeHidden();
    // Begin Game is still disabled (we only filled 1 of N seats).
    await expect(page.locator('[data-testid="begin-game-button"]')).toBeDisabled();
  });

  test('back button navigates to the landing page', async ({ page }) => {
    await page.locator('[data-testid="back-button"]').click();
    await expect(page.locator('[data-testid="center-circle"]')).toBeVisible({
      timeout: TIMEOUTS.PAGE_LOAD,
    });
  });
});
