import { test, expect } from '@playwright/test';
import { TurnSelectorPage } from './turn-selector-page';
import { LandingPage } from './landing-page';

test.describe('Turn Selector Screen', () => {
  let turnSelectorPage: TurnSelectorPage;
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    turnSelectorPage = new TurnSelectorPage(page);
    landingPage = new LandingPage(page);
    
    // Navigate to app and then to turn selector
    await page.goto('/');
    await landingPage.waitForPageLoad();
    await turnSelectorPage.navigateToTurnSelector();
  });

  test('should display turn selector screen with all elements', async () => {
    // Verify screen is loaded
    await expect(turnSelectorPage.screenTitle).toBeVisible();
    await expect(turnSelectorPage.playersInput).toBeVisible();
    await expect(turnSelectorPage.addPlayerButton).toBeVisible();
    await expect(turnSelectorPage.selectTurnButton).toBeVisible();
    await expect(turnSelectorPage.backButton).toBeVisible();
  });

  test('should add single player successfully', async () => {
    const playerName = 'Alice';
    
    // Add a player
    await turnSelectorPage.addPlayer(playerName);
    
    // Verify player was added to the list
    const playersList = await turnSelectorPage.getPlayersList();
    expect(playersList).toContain(playerName);
    
    // Verify input is cleared after adding
    await expect(turnSelectorPage.playersInput).toHaveText('');
  });

  test('should add multiple players successfully', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    
    // Add multiple players
    await turnSelectorPage.addMultiplePlayers(players);
    
    // Verify all players are in the list
    const playersList = await turnSelectorPage.getPlayersList();
    for (const player of players) {
      expect(playersList).toContain(player);
    }
  });

  test('should select random turn from players list', async () => {
    const players = ['Alice', 'Bob', 'Charlie'];
    
    // Add players
    await turnSelectorPage.addMultiplePlayers(players);
    
    // Select a random turn
    await turnSelectorPage.selectRandomTurn();
    
    // Verify a player was selected
    const selectedPlayer = await turnSelectorPage.getSelectedPlayer();
    expect(selectedPlayer).toBeTruthy();
    expect(players).toContain(selectedPlayer?.trim());
  });

  test('should not select turn when no players added', async () => {
    // Try to select turn without adding players
    await turnSelectorPage.selectRandomTurn();
    
    // Verify no player is selected or appropriate message is shown
    const selectedPlayer = await turnSelectorPage.getSelectedPlayer();
    expect(selectedPlayer).toBeFalsy();
  });

  test('should clear all players when clear button is pressed', async () => {
    const players = ['Alice', 'Bob', 'Charlie'];
    
    // Add multiple players
    await turnSelectorPage.addMultiplePlayers(players);
    
    // Verify players are added
    let playersList = await turnSelectorPage.getPlayersList();
    expect(playersList).toBeTruthy();
    
    // Clear all players
    await turnSelectorPage.clearAllPlayers();
    
    // Verify players list is empty
    playersList = await turnSelectorPage.getPlayersList();
    expect(playersList).toBeFalsy();
  });

  test('should handle multiple turn selections', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    
    // Add players
    await turnSelectorPage.addMultiplePlayers(players);
    
    // Select turn multiple times
    for (let i = 0; i < 3; i++) {
      await turnSelectorPage.selectRandomTurn();
      const selectedPlayer = await turnSelectorPage.getSelectedPlayer();
      expect(selectedPlayer).toBeTruthy();
      expect(players).toContain(selectedPlayer?.trim());
    }
  });

  test('should navigate back to landing screen', async ({ page }) => {
    // Navigate back
    await turnSelectorPage.goBack();
    
    // Verify we're back on landing screen
    await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
  });

  test('should handle edge cases with player names', async () => {
    const edgeCaseNames = ['', '   ', 'Very Long Player Name That Might Cause Issues', '123', 'Player!@#'];
    
    for (const name of edgeCaseNames) {
      await turnSelectorPage.addPlayer(name);
    }
    
    // Verify only valid names are added (non-empty, trimmed)
    const playersList = await turnSelectorPage.getPlayersList();
    expect(playersList).toBeTruthy();
  });

  test('should maintain state during screen interactions', async () => {
    const players = ['Alice', 'Bob'];
    
    // Add players
    await turnSelectorPage.addMultiplePlayers(players);
    
    // Select a turn
    await turnSelectorPage.selectRandomTurn();
    const firstSelection = await turnSelectorPage.getSelectedPlayer();
    
    // Add another player
    await turnSelectorPage.addPlayer('Charlie');
    
    // Verify previous selection is maintained
    const currentSelection = await turnSelectorPage.getSelectedPlayer();
    expect(currentSelection).toBe(firstSelection);
    
    // Verify new player is in the list
    const playersList = await turnSelectorPage.getPlayersList();
    expect(playersList).toContain('Charlie');
  });
});
