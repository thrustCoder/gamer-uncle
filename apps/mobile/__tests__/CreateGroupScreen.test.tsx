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
const mockGroupState = {
  enabled: true,
  activeGroupId: 'g1',
  groups: [{
    id: 'g1', name: 'Group 1', playerCount: 2,
    playerNames: ['A', 'B'], teamCount: 2,
    gameScore: null, leaderboard: [],
    gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null,
  }],
};
jest.mock('../store/PlayerGroupsContext', () => ({
  usePlayerGroups: () => ({
    state: mockGroupState,
    createGroup: mockCreateGroup,
    updateGroup: mockUpdateGroup,
  }),
  PlayerGroupsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockRouteParams: any = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const renderScreen = () => render(<CreateGroupScreen />);

describe('CreateGroupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
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

  it('should call createGroup with correct args on save', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('group-name-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('group-name-input'), 'Weekend Warriors');
    fireEvent.press(getByTestId('save-group-button'));

    expect(mockCreateGroup).toHaveBeenCalledWith(
      'Weekend Warriors',
      4,
      expect.any(Array),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should clear error when typing a name', async () => {
    const { getByTestId, getByText, queryByText } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('save-group-button')).toBeTruthy();
    });

    // Trigger error
    fireEvent.changeText(getByTestId('group-name-input'), '');
    fireEvent.press(getByTestId('save-group-button'));
    expect(getByText('Group name is required')).toBeTruthy();

    // Type a name - error should disappear
    fireEvent.changeText(getByTestId('group-name-input'), 'Test');
    expect(queryByText('Group name is required')).toBeNull();
  });

  it('should allow editing player names', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('group-player-name-0')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('group-player-name-0'), 'Alice');
    fireEvent.changeText(getByTestId('group-player-name-1'), 'Bob');

    const input0 = getByTestId('group-player-name-0');
    const input1 = getByTestId('group-player-name-1');
    expect(input0.props.value).toBe('Alice');
    expect(input1.props.value).toBe('Bob');
  });

  describe('edit mode', () => {
    it('should show Edit Group title when editing', async () => {
      mockRouteParams = { groupId: 'g1' };
      const { getByText } = renderScreen();

      await waitFor(() => {
        expect(getByText('Edit Group')).toBeTruthy();
      });
    });

    it('should pre-populate form with existing group data', async () => {
      mockRouteParams = { groupId: 'g1' };
      const { getByTestId } = renderScreen();

      await waitFor(() => {
        const nameInput = getByTestId('group-name-input');
        expect(nameInput.props.value).toBe('Group 1');
      });
    });

    it('should show Save Changes button text in edit mode', async () => {
      mockRouteParams = { groupId: 'g1' };
      const { getByText } = renderScreen();

      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
    });

    it('should call updateGroup instead of createGroup in edit mode', async () => {
      mockRouteParams = { groupId: 'g1' };
      const { getByTestId } = renderScreen();

      await waitFor(() => {
        expect(getByTestId('group-name-input')).toBeTruthy();
      });

      fireEvent.changeText(getByTestId('group-name-input'), 'Updated Name');
      fireEvent.press(getByTestId('save-group-button'));

      expect(mockUpdateGroup).toHaveBeenCalledWith('g1', expect.objectContaining({
        name: 'Updated Name',
      }));
      expect(mockCreateGroup).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
