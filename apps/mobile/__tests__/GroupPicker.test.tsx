import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
jest.mock('../services/Telemetry', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    PLAYER_GROUP_SWITCHED: 'PlayerGroups.Switched',
  },
}));

const twoGroupsState = {
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
});
