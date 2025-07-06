import { Page, Locator } from '@playwright/test';

export class TurnSelectorPage {
  readonly page: Page;
  readonly screenTitle: Locator;
  readonly playersInput: Locator;
  readonly addPlayerButton: Locator;
  readonly clearPlayersButton: Locator;
  readonly selectTurnButton: Locator;
  readonly selectedPlayerDisplay: Locator;
  readonly playersList: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.screenTitle = page.getByTestId('turn-selector-title');
    this.playersInput = page.getByTestId('turn-selector-player-input');
    this.addPlayerButton = page.getByTestId('turn-selector-add-player-button');
    this.clearPlayersButton = page.getByTestId('turn-selector-clear-players-button');
    this.selectTurnButton = page.getByTestId('turn-selector-select-turn-button');
    this.selectedPlayerDisplay = page.getByTestId('turn-selector-selected-player');
    this.playersList = page.getByTestId('turn-selector-players-list');
    this.backButton = page.getByTestId('back-button');
  }

  async navigateToTurnSelector() {
    await this.page.getByTestId('landing-turn-selector-button').tap();
    await this.page.waitForSelector('[data-testid="turn-selector-title"]');
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

  async selectRandomTurn() {
    await this.selectTurnButton.tap();
  }

  async getPlayersList() {
    return await this.playersList.textContent();
  }

  async getSelectedPlayer() {
    return await this.selectedPlayerDisplay.textContent();
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
