import { TurnSelectorPage } from '../e2e/turn-selector-page';
import { TeamRandomizerPage } from '../e2e/team-randomizer-page';

describe('Turn Selector Page Object', () => {
  let mockPage: any;
  let turnSelectorPage: TurnSelectorPage;

  beforeEach(() => {
    mockPage = {
      getByTestId: jest.fn().mockReturnValue({
        tap: jest.fn(),
        fill: jest.fn(),
        textContent: jest.fn(),
        waitFor: jest.fn(),
        isVisible: jest.fn()
      }),
      waitForSelector: jest.fn()
    };
    turnSelectorPage = new TurnSelectorPage(mockPage);
  });

  test('should initialize with correct selectors', () => {
    expect(mockPage.getByTestId).toHaveBeenCalledWith('turn-selector-title');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('turn-selector-player-input');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('turn-selector-add-player-button');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('turn-selector-select-turn-button');
  });

  test('should call correct navigation method', async () => {
    await turnSelectorPage.navigateToTurnSelector();
    
    expect(mockPage.getByTestId).toHaveBeenCalledWith('landing-turn-selector-button');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="turn-selector-title"]');
  });

  test('should add player correctly', async () => {
    const playerName = 'TestPlayer';
    await turnSelectorPage.addPlayer(playerName);
    
    expect(mockPage.getByTestId('turn-selector-player-input').fill).toHaveBeenCalledWith(playerName);
    expect(mockPage.getByTestId('turn-selector-add-player-button').tap).toHaveBeenCalled();
  });

  test('should add multiple players correctly', async () => {
    const players = ['Player1', 'Player2', 'Player3'];
    await turnSelectorPage.addMultiplePlayers(players);
    
    expect(mockPage.getByTestId('turn-selector-player-input').fill).toHaveBeenCalledTimes(3);
    expect(mockPage.getByTestId('turn-selector-add-player-button').tap).toHaveBeenCalledTimes(3);
  });

  test('should clear players when requested', async () => {
    await turnSelectorPage.clearAllPlayers();
    
    expect(mockPage.getByTestId('turn-selector-clear-players-button').tap).toHaveBeenCalled();
  });

  test('should select random turn when requested', async () => {
    await turnSelectorPage.selectRandomTurn();
    
    expect(mockPage.getByTestId('turn-selector-select-turn-button').tap).toHaveBeenCalled();
  });

  test('should navigate back correctly', async () => {
    await turnSelectorPage.goBack();
    
    expect(mockPage.getByTestId('back-button').tap).toHaveBeenCalled();
  });
});

describe('Team Randomizer Page Object', () => {
  let mockPage: any;
  let teamRandomizerPage: TeamRandomizerPage;

  beforeEach(() => {
    mockPage = {
      getByTestId: jest.fn().mockReturnValue({
        tap: jest.fn(),
        fill: jest.fn(),
        textContent: jest.fn(),
        waitFor: jest.fn(),
        isVisible: jest.fn()
      }),
      waitForSelector: jest.fn()
    };
    teamRandomizerPage = new TeamRandomizerPage(mockPage);
  });

  test('should initialize with correct selectors', () => {
    expect(mockPage.getByTestId).toHaveBeenCalledWith('team-randomizer-title');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('team-randomizer-player-input');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('team-randomizer-add-player-button');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('team-randomizer-teams-count-input');
    expect(mockPage.getByTestId).toHaveBeenCalledWith('team-randomizer-generate-teams-button');
  });

  test('should call correct navigation method', async () => {
    await teamRandomizerPage.navigateToTeamRandomizer();
    
    expect(mockPage.getByTestId).toHaveBeenCalledWith('landing-team-randomizer-button');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="team-randomizer-title"]');
  });

  test('should add player correctly', async () => {
    const playerName = 'TestPlayer';
    await teamRandomizerPage.addPlayer(playerName);
    
    expect(mockPage.getByTestId('team-randomizer-player-input').fill).toHaveBeenCalledWith(playerName);
    expect(mockPage.getByTestId('team-randomizer-add-player-button').tap).toHaveBeenCalled();
  });

  test('should set teams count correctly', async () => {
    const teamsCount = 3;
    await teamRandomizerPage.setTeamsCount(teamsCount);
    
    expect(mockPage.getByTestId('team-randomizer-teams-count-input').fill).toHaveBeenCalledWith('3');
  });

  test('should generate teams when requested', async () => {
    await teamRandomizerPage.generateTeams();
    
    expect(mockPage.getByTestId('team-randomizer-generate-teams-button').tap).toHaveBeenCalled();
  });

  test('should clear players when requested', async () => {
    await teamRandomizerPage.clearAllPlayers();
    
    expect(mockPage.getByTestId('team-randomizer-clear-players-button').tap).toHaveBeenCalled();
  });

  test('should navigate back correctly', async () => {
    await teamRandomizerPage.goBack();
    
    expect(mockPage.getByTestId('back-button').tap).toHaveBeenCalled();
  });
});
