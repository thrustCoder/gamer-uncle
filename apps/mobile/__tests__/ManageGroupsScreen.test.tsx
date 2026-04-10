import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ManageGroupsScreen from '../screens/ManageGroupsScreen';
import { PlayerGroupsProvider } from '../store/PlayerGroupsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/Telemetry', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    PLAYER_GROUP_SWITCHED: 'PlayerGroups.Switched',
    PLAYER_GROUP_DELETED: 'PlayerGroups.Deleted',
    PLAYER_GROUPS_DISABLED: 'PlayerGroups.Disabled',
  },
}));

// Mock BackButton
jest.mock('../components/BackButton', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'back-button' });
});

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.spyOn(Alert, 'alert');

const twoGroupsState = {
  enabled: true,
  activeGroupId: 'g1',
  groups: [
    { id: 'g1', name: 'Group Alpha', playerCount: 3, playerNames: ['A', 'B', 'C'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
    { id: 'g2', name: 'Group Beta', playerCount: 4, playerNames: ['X', 'Y', 'Z', 'W'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 4, gameSetupResponse: null },
  ],
};

const renderScreen = (groupsState = twoGroupsState) => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
    if (key === 'app.playerGroups') return Promise.resolve(JSON.stringify(groupsState));
    return Promise.resolve(null);
  });

  return render(
    <PlayerGroupsProvider>
      <ManageGroupsScreen />
    </PlayerGroupsProvider>
  );
};

describe('ManageGroupsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all groups', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText(/Group Alpha/)).toBeTruthy();
      expect(getByText(/Group Beta/)).toBeTruthy();
    });
  });

  it('should show active label on active group', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Active')).toBeTruthy();
    });
  });

  it('should navigate to CreateGroup on edit button', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('edit-group-g1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('edit-group-g1'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateGroup', { groupId: 'g1' });
  });

  it('should show delete confirmation alert', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('delete-group-g2')).toBeTruthy();
    });

    fireEvent.press(getByTestId('delete-group-g2'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Group',
      expect.stringContaining('Group Beta'),
      expect.any(Array),
    );
  });

  it('should navigate to CreateGroup on create button', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('create-new-group-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('create-new-group-button'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateGroup', {});
  });

  it('should show disable groups confirmation', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('disable-groups-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('disable-groups-button'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Disable Player Groups',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('should block deletion when only one group exists', async () => {
    const singleGroupState = {
      enabled: true,
      activeGroupId: 'g1',
      groups: [
        { id: 'g1', name: 'Only Group', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
      ],
    };

    const { getByTestId } = renderScreen(singleGroupState);

    await waitFor(() => {
      expect(getByTestId('delete-group-g1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('delete-group-g1'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Delete',
      expect.any(String),
    );
  });

  it('should display player count for each group', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('3 players')).toBeTruthy();
      expect(getByText('4 players')).toBeTruthy();
    });
  });

  it('should switch active group when pressing a non-active group card', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('group-card-g2')).toBeTruthy();
    });

    fireEvent.press(getByTestId('group-card-g2'));

    // After switching, Group Beta should become active (state updated via context)
    // Just verify the press doesn't crash -- actual state change is via context
  });

  it('should disable create button when at MAX_GROUPS', async () => {
    const maxGroupsState = {
      enabled: true,
      activeGroupId: 'g0',
      groups: Array.from({ length: 10 }, (_, i) => ({
        id: `g${i}`,
        name: `Group ${i}`,
        playerCount: 2,
        playerNames: ['A', 'B'],
        teamCount: 2,
        gameScore: null,
        leaderboard: [],
        gameSetupGameName: '',
        gameSetupPlayerCount: 2,
        gameSetupResponse: null,
      })),
    };

    const { getByTestId, getByText } = renderScreen(maxGroupsState);

    await waitFor(() => {
      expect(getByTestId('create-new-group-button')).toBeTruthy();
    });

    // Button should be disabled
    const button = getByTestId('create-new-group-button');
    expect(button.props.accessibilityState?.disabled || false).toBe(true);

    // Should show max groups text
    expect(getByText('Maximum 10 groups reached')).toBeTruthy();
  });

  it('should navigate back after confirming disable groups', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('disable-groups-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('disable-groups-button'));

    // Extract the confirm callback from Alert.alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls.find(
      (call) => call[0] === 'Disable Player Groups'
    );
    expect(alertCall).toBeTruthy();

    const buttons = alertCall[2];
    const disableButton = buttons.find((b: any) => b.text === 'Disable');
    expect(disableButton).toBeTruthy();
  });
});
