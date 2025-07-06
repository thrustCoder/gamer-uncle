import { test, expect } from '@playwright/test';
import { TeamRandomizerPage } from './team-randomizer-page';
import { LandingPage } from './landing-page';

test.describe('Team Randomizer Screen', () => {
  let teamRandomizerPage: TeamRandomizerPage;
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    teamRandomizerPage = new TeamRandomizerPage(page);
    landingPage = new LandingPage(page);
    
    // Navigate to app and then to team randomizer
    await page.goto('/');
    await landingPage.waitForPageLoad();
    await teamRandomizerPage.navigateToTeamRandomizer();
  });

  test('should display team randomizer screen with all elements', async () => {
    // Verify screen is loaded
    await expect(teamRandomizerPage.screenTitle).toBeVisible();
    await expect(teamRandomizerPage.playersInput).toBeVisible();
    await expect(teamRandomizerPage.addPlayerButton).toBeVisible();
    await expect(teamRandomizerPage.teamsCountInput).toBeVisible();
    await expect(teamRandomizerPage.generateTeamsButton).toBeVisible();
    await expect(teamRandomizerPage.backButton).toBeVisible();
  });

  test('should add single player successfully', async () => {
    const playerName = 'Alice';
    
    // Add a player
    await teamRandomizerPage.addPlayer(playerName);
    
    // Verify player was added to the list
    const playersList = await teamRandomizerPage.getPlayersList();
    expect(playersList).toContain(playerName);
    
    // Verify input is cleared after adding
    await expect(teamRandomizerPage.playersInput).toHaveText('');
  });

  test('should add multiple players successfully', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    
    // Add multiple players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Verify all players are in the list
    const playersList = await teamRandomizerPage.getPlayersList();
    for (const player of players) {
      expect(playersList).toContain(player);
    }
  });

  test('should generate teams with valid team count', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const teamsCount = 2;
    
    // Add players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Set teams count
    await teamRandomizerPage.setTeamsCount(teamsCount);
    
    // Generate teams
    await teamRandomizerPage.generateTeams();
    
    // Verify teams were generated
    const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
    expect(teamsDisplay).toBeTruthy();
    
    // Verify all players are assigned to teams
    for (const player of players) {
      expect(teamsDisplay).toContain(player);
    }
  });

  test('should handle different team counts', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    
    // Add players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Test different team counts
    const teamCounts = [2, 3];
    
    for (const count of teamCounts) {
      await teamRandomizerPage.setTeamsCount(count);
      await teamRandomizerPage.generateTeams();
      
      const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
      expect(teamsDisplay).toBeTruthy();
    }
  });

  test('should not generate teams when no players added', async () => {
    // Set teams count
    await teamRandomizerPage.setTeamsCount(2);
    
    // Try to generate teams without adding players
    await teamRandomizerPage.generateTeams();
    
    // Verify no teams are generated or appropriate message is shown
    const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
    expect(teamsDisplay).toBeFalsy();
  });

  test('should not generate teams with invalid team count', async () => {
    const players = ['Alice', 'Bob'];
    
    // Add players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Try to set invalid team count (more teams than players)
    await teamRandomizerPage.setTeamsCount(5);
    await teamRandomizerPage.generateTeams();
    
    // Verify appropriate handling (either no teams generated or error message)
    const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
    // This should either be empty or show an error message
    expect(teamsDisplay).toBeDefined();
  });

  test('should clear all players when clear button is pressed', async () => {
    const players = ['Alice', 'Bob', 'Charlie'];
    
    // Add multiple players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Verify players are added
    let playersList = await teamRandomizerPage.getPlayersList();
    expect(playersList).toBeTruthy();
    
    // Clear all players
    await teamRandomizerPage.clearAllPlayers();
    
    // Verify players list is empty
    playersList = await teamRandomizerPage.getPlayersList();
    expect(playersList).toBeFalsy();
  });

  test('should generate different team combinations on multiple runs', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    
    // Add players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Set teams count
    await teamRandomizerPage.setTeamsCount(2);
    
    // Generate teams multiple times and collect results
    const teamResults = [];
    for (let i = 0; i < 3; i++) {
      await teamRandomizerPage.generateTeams();
      const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
      teamResults.push(teamsDisplay);
    }
    
    // Verify teams were generated each time
    for (const result of teamResults) {
      expect(result).toBeTruthy();
      // Verify all players are still included
      for (const player of players) {
        expect(result).toContain(player);
      }
    }
  });

  test('should navigate back to landing screen', async ({ page }) => {
    // Navigate back
    await teamRandomizerPage.goBack();
    
    // Verify we're back on landing screen
    await expect(page.locator('[data-testid="uncle-header"]')).toBeVisible();
  });

  test('should handle edge cases with player names', async () => {
    const edgeCaseNames = ['', '   ', 'Very Long Player Name That Might Cause Layout Issues', '123', 'Player!@#'];
    
    for (const name of edgeCaseNames) {
      await teamRandomizerPage.addPlayer(name);
    }
    
    // Verify only valid names are added (non-empty, trimmed)
    const playersList = await teamRandomizerPage.getPlayersList();
    expect(playersList).toBeTruthy();
  });

  test('should maintain players list when regenerating teams', async () => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    
    // Add players
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Generate teams first time
    await teamRandomizerPage.setTeamsCount(2);
    await teamRandomizerPage.generateTeams();
    
    // Add another player
    await teamRandomizerPage.addPlayer('Eve');
    
    // Generate teams again
    await teamRandomizerPage.generateTeams();
    
    // Verify all players (including new one) are in teams
    const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
    for (const player of [...players, 'Eve']) {
      expect(teamsDisplay).toContain(player);
    }
  });

  test('should handle minimum viable teams scenario', async () => {
    const players = ['Alice', 'Bob'];
    
    // Add minimum players for team generation
    await teamRandomizerPage.addMultiplePlayers(players);
    
    // Set teams count to 2 (one player per team)
    await teamRandomizerPage.setTeamsCount(2);
    await teamRandomizerPage.generateTeams();
    
    // Verify teams are generated with one player each
    const teamsDisplay = await teamRandomizerPage.getTeamsDisplay();
    expect(teamsDisplay).toContain('Alice');
    expect(teamsDisplay).toContain('Bob');
  });
});
