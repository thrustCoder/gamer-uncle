import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CreateGroupScreen from '../screens/CreateGroupScreen';
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
    PLAYER_GROUP_CREATED: 'PlayerGroups.Created',
  },
}));

// Mock BackButton
jest.mock('../components/BackButton', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('View', { testID: 'back-button' });
  },
}));

// Mock useDebouncedEffect to be synchronous
jest.mock('../services/hooks/useDebouncedEffect', () => ({
  useDebouncedEffect: (callback: () => void, deps: any[]) => {
    const React = require('react');
    React.useEffect(callback, deps);
  },
}));

const mockCreateGroup = jest.fn();
const mockUpdateGroup = jest.fn();
jest.mock('../store/PlayerGroupsContext', () => ({
  usePlayerGroups: () => ({
    state: {
      enabled: true,
      activeGroupId: 'g1',
      groups: [{
        id: 'g1', name: 'Group 1', playerCount: 2,
        playerNames: ['A', 'B'], teamCount: 2,
        gameScore: null, leaderboard: [],
        gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null,
      }],
    },
    createGroup: mockCreateGroup,
    updateGroup: mockUpdateGroup,
  }),
  PlayerGroupsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: {} }),
}));

const renderScreen = () => render(<CreateGroupScreen />);

describe('CreateGroupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render create group form', async () => {
    const { getByTestId, getAllByText } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('group-name-input')).toBeTruthy();
      expect(getByTestId('group-player-count-button')).toBeTruthy();
      expect(getAllByText('Create Group').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show error when saving with empty name', async () => {
    const { getByTestId, getByText } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('save-group-button')).toBeTruthy();
    });

    // Clear the name input and press save
    fireEvent.changeText(getByTestId('group-name-input'), '');
    fireEvent.press(getByTestId('save-group-button'));

    await waitFor(() => {
      expect(getByText('Group name is required')).toBeTruthy();
    });
  });

  it('should save and navigate back on valid input', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('group-name-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('group-name-input'), 'Friday Night');
    fireEvent.press(getByTestId('save-group-button'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should show player name inputs for 4 players', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('group-player-name-0')).toBeTruthy();
      expect(getByTestId('group-player-name-1')).toBeTruthy();
      expect(getByTestId('group-player-name-2')).toBeTruthy();
      expect(getByTestId('group-player-name-3')).toBeTruthy();
    });
  });
});
