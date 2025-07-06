import { Page, Locator } from '@playwright/test';

export class TeamRandomizerPage {
  readonly page: Page;
  readonly screenTitle: Locator;
  readonly playersInput: Locator;
  readonly addPlayerButton: Locator;
  readonly clearPlayersButton: Locator;
  readonly teamsCountInput: Locator;
  readonly generateTeamsButton: Locator;
  readonly teamsDisplay: Locator;
  readonly playersList: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.screenTitle = page.getByTestId('team-randomizer-title');
    this.playersInput = page.getByTestId('team-randomizer-player-input');
    this.addPlayerButton = page.getByTestId('team-randomizer-add-player-button');
    this.clearPlayersButton = page.getByTestId('team-randomizer-clear-players-button');
    this.teamsCountInput = page.getByTestId('team-randomizer-teams-count-input');
    this.generateTeamsButton = page.getByTestId('team-randomizer-generate-teams-button');
    this.teamsDisplay = page.getByTestId('team-randomizer-teams-display');
    this.playersList = page.getByTestId('team-randomizer-players-list');
    this.backButton = page.getByTestId('back-button');
  }

  async navigateToTeamRandomizer() {
    await this.page.getByTestId('landing-team-randomizer-button').tap();
    await this.page.waitForSelector('[data-testid="team-randomizer-title"]');
  }

  async addPlayer(playerName: string) {
    await this.playersInput.fill(playerName);
    await this.addPlayerButton.tap();
  }

  async addMultiplePlayers(playerNames: string[]) {
    for (const name of playerNames) {
      await this.addPlayer(name);
    }
  }

  async clearAllPlayers() {
    await this.clearPlayersButton.tap();
  }

  async setTeamsCount(count: number) {
    await this.teamsCountInput.fill(count.toString());
  }

  async generateTeams() {
    await this.generateTeamsButton.tap();
  }

  async getPlayersList() {
    return await this.playersList.textContent();
  }

  async getTeamsDisplay() {
    return await this.teamsDisplay.textContent();
  }

  async goBack() {
    await this.backButton.tap();
  }

  async waitForScreenLoad() {
    await this.screenTitle.waitFor({ state: 'visible' });
  }

  async isScreenVisible() {
    return await this.screenTitle.isVisible();
  }
}
