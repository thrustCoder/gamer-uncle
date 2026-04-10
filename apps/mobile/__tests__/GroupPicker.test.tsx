import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import GroupPicker from '../components/GroupPicker';
import { PlayerGroupsProvider } from '../store/PlayerGroupsContext';
import { ScoreTrackerProvider } from '../store/ScoreTrackerContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Telemetry
const mockTrackEvent = jest.fn();
jest.mock('../services/Telemetry', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvents: {
    PLAYER_GROUP_SWITCHED: 'PlayerGroups.Switched',
  },
}));

// Mock useDebouncedEffect to be synchronous
jest.mock('../services/hooks/useDebouncedEffect', () => ({
  useDebouncedEffect: (callback: () => void, deps: any[]) => {
    const React = require('react');
    React.useEffect(callback, deps);
  },
}));

// Spy on Alert
jest.spyOn(Alert, 'alert');

const twoGroupsState: {
  enabled: boolean;
  activeGroupId: string | null;
  groups: Array<{
    id: string; name: string; playerCount: number; playerNames: string[];
    teamCount: number; gameScore: null; leaderboard: never[];
    gameSetupGameName: string; gameSetupPlayerCount: number; gameSetupResponse: null;
  }>;
} = {
  enabled: true,
  activeGroupId: 'g1',
  groups: [
    { id: 'g1', name: 'Group Alpha', playerCount: 3, playerNames: ['A', 'B', 'C'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
    { id: 'g2', name: 'Group Beta', playerCount: 4, playerNames: ['X', 'Y', 'Z', 'W'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 4, gameSetupResponse: null },
  ],
};

const renderWithProviders = (ui: React.ReactElement, groupsState = twoGroupsState) => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
    if (key === 'app.playerGroups') return Promise.resolve(JSON.stringify(groupsState));
    return Promise.resolve(null);
  });

  return render(
    <ScoreTrackerProvider>
      <PlayerGroupsProvider>
        {ui}
      </PlayerGroupsProvider>
    </ScoreTrackerProvider>
  );
};

describe('GroupPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display active group name', async () => {
    const onManageGroups = jest.fn();
    const { getByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByText('Group Alpha')).toBeTruthy();
    });
  });

  it('should show manage groups link', async () => {
    const onManageGroups = jest.fn();
    const { getByTestId } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByTestId('manage-groups-link')).toBeTruthy();
    });

    fireEvent.press(getByTestId('manage-groups-link'));
    expect(onManageGroups).toHaveBeenCalled();
  });

  it('should open dropdown when pressed', async () => {
    const onManageGroups = jest.fn();
    const { getByTestId, getByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByTestId('group-picker-dropdown')).toBeTruthy();
    });

    fireEvent.press(getByTestId('group-picker-dropdown'));

    await waitFor(() => {
      expect(getByText('Select Group')).toBeTruthy();
      expect(getByText('Group Beta')).toBeTruthy();
    });
  });

  it('should show all groups in dropdown', async () => {
    const onManageGroups = jest.fn();
    const { getByTestId, getAllByText, getByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByTestId('group-picker-dropdown')).toBeTruthy();
    });

    fireEvent.press(getByTestId('group-picker-dropdown'));

    await waitFor(() => {
      // Group Alpha appears in both the trigger and dropdown
      expect(getAllByText('Group Alpha').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Group Beta')).toBeTruthy();
      expect(getByText('3 players')).toBeTruthy();
      expect(getByText('4 players')).toBeTruthy();
    });
  });

  it('should close dropdown when selecting the already active group', async () => {
    const onManageGroups = jest.fn();
    const { getByTestId, getAllByText, getByText, queryByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByTestId('group-picker-dropdown')).toBeTruthy();
    });

    fireEvent.press(getByTestId('group-picker-dropdown'));

    await waitFor(() => {
      expect(getByText('Select Group')).toBeTruthy();
    });

    // Press the already active group (may appear multiple times: trigger + dropdown)
    const alphaElements = getAllByText('Group Alpha');
    fireEvent.press(alphaElements[alphaElements.length - 1]);

    // Dropdown should close
    await waitFor(() => {
      expect(queryByText('Select Group')).toBeNull();
    });
  });

  it('should switch to a different group when selected', async () => {
    const onManageGroups = jest.fn();
    const { getByTestId, getByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByTestId('group-picker-dropdown')).toBeTruthy();
    });

    fireEvent.press(getByTestId('group-picker-dropdown'));

    await waitFor(() => {
      expect(getByText('Group Beta')).toBeTruthy();
    });

    fireEvent.press(getByText('Group Beta'));

    // Should track the event and switch
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('PlayerGroups.Switched', expect.objectContaining({ groupId: 'g2' }));
    });
  });

  it('should show Active Group label', async () => {
    const onManageGroups = jest.fn();
    const { getByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />
    );

    await waitFor(() => {
      expect(getByText('Active Group')).toBeTruthy();
    });
  });

  it('should show Select Group when no active group', async () => {
    const noActiveState: typeof twoGroupsState = {
      enabled: true,
      activeGroupId: null,
      groups: [],
    };
    const onManageGroups = jest.fn();
    const { getByText } = renderWithProviders(
      <GroupPicker onManageGroups={onManageGroups} />,
      noActiveState,
    );

    await waitFor(() => {
      expect(getByText('Select Group')).toBeTruthy();
    });
  });

  it('should warn when switching during active score session', async () => {
    // Set up a state with an active game score session
    const stateWithScore = {
      enabled: true,
      activeGroupId: 'g1',
      groups: [
        { id: 'g1', name: 'Group Alpha', playerCount: 3, playerNames: ['A', 'B', 'C'], teamCount: 2,
          gameScore: { gameInfo: { name: 'Catan' }, rounds: [{ roundNumber: 1, scores: { A: 10, B: 20, C: 30 } }], lowestScoreWins: false },
          leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
        { id: 'g2', name: 'Group Beta', playerCount: 4, playerNames: ['X', 'Y', 'Z', 'W'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 4, gameSetupResponse: null },
      ],
    };

    // AppCache needs to return the game score for ScoreTrackerContext hydration
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'app.playerGroups') return Promise.resolve(JSON.stringify(stateWithScore));
      if (key === 'app.scoreTracker.gameScore') return Promise.resolve(JSON.stringify(stateWithScore.groups[0].gameScore));
      return Promise.resolve(null);
    });

    const onManageGroups = jest.fn();
    const { getByTestId, getByText } = render(
      <ScoreTrackerProvider>
        <PlayerGroupsProvider>
          <GroupPicker onManageGroups={onManageGroups} />
        </PlayerGroupsProvider>
      </ScoreTrackerProvider>
    );

    await waitFor(() => {
      expect(getByTestId('group-picker-dropdown')).toBeTruthy();
    });

    fireEvent.press(getByTestId('group-picker-dropdown'));

    await waitFor(() => {
      expect(getByText('Group Beta')).toBeTruthy();
    });

    fireEvent.press(getByText('Group Beta'));

    // Should show warning alert because there's an active game score session
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Switch Group?',
        expect.stringContaining('save your current session'),
        expect.any(Array),
      );
    });
  });
});
