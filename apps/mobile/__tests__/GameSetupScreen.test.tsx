import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock KeyboardAvoidingView by mocking the specific component path
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props, props.children),
  };
});

import GameSetupScreen from '../screens/GameSetupScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock BackButton
jest.mock('../components/BackButton', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockBackButton() {
    return React.createElement(View, { testID: 'back-button' });
  };
});

// Mock MarkdownText - return a proper React component
jest.mock('../components/MarkdownText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockMarkdownText({ text }: { text: string }) {
    return React.createElement(Text, { testID: 'markdown-text' }, text);
  };
});

// Mock Telemetry
const mockTrackEvent = jest.fn();
jest.mock('../services/Telemetry', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvents: {
    ERROR_GAME_SETUP: 'Error.GameSetup',
  },
}));

// Mock API client
const mockGetRecommendations = jest.fn();
jest.mock('../services/ApiClient', () => ({
  getRecommendations: (...args: any[]) => mockGetRecommendations(...args),
}));

// Mock appCache
jest.mock('../services/storage/appCache', () => ({
  appCache: {
    getGameSetupGameName: jest.fn((): Promise<string> => Promise.resolve('')),
    setGameSetupGameName: jest.fn((): Promise<void> => Promise.resolve()),
    getGameSetupPlayerCount: jest.fn((): Promise<number> => Promise.resolve(4)),
    setGameSetupPlayerCount: jest.fn((): Promise<void> => Promise.resolve()),
    getGameSetupResponse: jest.fn((): Promise<string | null> => Promise.resolve(null)),
    setGameSetupResponse: jest.fn((): Promise<void> => Promise.resolve()),
    clearGameSetup: jest.fn((): Promise<void> => Promise.resolve()),
  },
}));

// Get reference to mocked appCache for assertions
import { appCache } from '../services/storage/appCache';
const mockAppCache = appCache as jest.Mocked<typeof appCache>;

// Spy on Alert
jest.spyOn(Alert, 'alert');

describe('GameSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default state', () => {
    const { getByText, getByTestId, getByPlaceholderText } = render(<GameSetupScreen />);
    
    expect(getByText('Game Setup')).toBeTruthy();
    expect(getByText('Get setup instructions for any board game')).toBeTruthy();
    expect(getByPlaceholderText(/Catan, Ticket to Ride/)).toBeTruthy();
    expect(getByTestId('player-count-picker')).toBeTruthy();
    expect(getByText('4 Players')).toBeTruthy();
    expect(getByText('🎲 Get Game Setup')).toBeTruthy();
  });

  it('updates gameName on text input', () => {
    const { getByTestId } = render(<GameSetupScreen />);
    
    const input = getByTestId('game-name-input');
    fireEvent.changeText(input, 'Catan');
    
    expect(input.props.value).toBe('Catan');
  });

  it('shows alert when trying to submit without game name', () => {
    const { getByTestId } = render(<GameSetupScreen />);
    
    const submitButton = getByTestId('get-setup-button');
    fireEvent.press(submitButton);
    
    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing Game Name',
      'Please enter the name of the game.'
    );
  });

  it('shows player count picker alert on press', () => {
    const { getByTestId } = render(<GameSetupScreen />);
    
    const pickerButton = getByTestId('player-count-picker');
    fireEvent.press(pickerButton);
    
    expect(Alert.alert).toHaveBeenCalledWith(
      'Select Number of Players',
      '',
      expect.any(Array)
    );
  });

  it('calls API with correct params when submitting', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      responseText: 'Setup instructions for Catan...',
    });

    const { getByTestId } = render(<GameSetupScreen />);
    
    // Enter game name
    const input = getByTestId('game-name-input');
    fireEvent.changeText(input, 'Catan');
    
    // Submit
    const submitButton = getByTestId('get-setup-button');
    fireEvent.press(submitButton);
    
    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          Query: expect.stringMatching(/Catan.*4 player/),
          UserId: expect.any(String),
          ConversationId: null,
        })
      );
    }, { timeout: 15000 });
  }, 20000);

  it('displays response after successful API call', async () => {
    const mockResponse = 'Setup instructions for Catan with 4 players:\n1. Place the board...';
    mockGetRecommendations.mockResolvedValueOnce({
      responseText: mockResponse,
    });

    const { getByTestId, getByText } = render(<GameSetupScreen />);
    
    // Enter game name
    const input = getByTestId('game-name-input');
    fireEvent.changeText(input, 'Catan');
    
    // Submit
    const submitButton = getByTestId('get-setup-button');
    fireEvent.press(submitButton);
    
    await waitFor(() => {
      expect(getByTestId('markdown-text')).toBeTruthy();
      expect(getByText(mockResponse)).toBeTruthy();
    });
  });

  it('shows "Need more help" button after response', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      responseText: 'Setup instructions...',
    });

    const { getByTestId } = render(<GameSetupScreen />);
    
    // Enter game name and submit
    fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    await waitFor(() => {
      expect(getByTestId('need-more-help-button')).toBeTruthy();
    });
  });

  it('navigates to Chat with prefill context when "Need more help" is pressed', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      responseText: 'Setup instructions...',
    });

    const { getByTestId } = render(<GameSetupScreen />);
    
    // Enter game name and submit
    fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    await waitFor(() => {
      expect(getByTestId('need-more-help-button')).toBeTruthy();
    });
    
    // Press "Need more help"
    fireEvent.press(getByTestId('need-more-help-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Chat', {
      prefillContext: {
        gameName: 'Catan',
        playerCount: 4,
        previousSetupQuery: true,
      },
    });
  });

  it('displays error message on API failure', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error('Network error'));

    const { getByTestId, getByText } = render(<GameSetupScreen />);
    
    // Enter game name and submit
    fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    await waitFor(() => {
      expect(getByText(/Network error/)).toBeTruthy();
    });
  });

  it('tracks telemetry on API failure', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error('Network error'));

    const { getByTestId } = render(<GameSetupScreen />);
    
    fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('Error.GameSetup', expect.objectContaining({
        error: 'Network error',
        gameName: 'Catan',
        playerCount: '4',
      }));
    });
  });

  it('tracks telemetry when response is empty', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ responseText: null });

    const { getByTestId } = render(<GameSetupScreen />);
    
    fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('Error.GameSetup', expect.objectContaining({
        error: 'empty_response',
        gameName: 'Catan',
      }));
    });
  });

  it('resets form when "New Game" button is pressed', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      responseText: 'Setup instructions...',
    });

    const { getByTestId, queryByTestId } = render(<GameSetupScreen />);
    
    // Enter game name and submit
    const input = getByTestId('game-name-input');
    fireEvent.changeText(input, 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    await waitFor(() => {
      expect(getByTestId('reset-button')).toBeTruthy();
    });
    
    // Press reset
    fireEvent.press(getByTestId('reset-button'));
    
    // Form should be reset
    expect(input.props.value).toBe('');
    expect(queryByTestId('markdown-text')).toBeNull();
  });

  it('shows loading state during API call', async () => {
    // Create a promise that we control
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockGetRecommendations.mockReturnValueOnce(promise);

    const { getByTestId, getByText } = render(<GameSetupScreen />);
    
    // Enter game name and submit
    fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
    fireEvent.press(getByTestId('get-setup-button'));
    
    // Should show loading text
    expect(getByText('Getting Setup...')).toBeTruthy();
    
    // Resolve the promise
    resolvePromise!({ responseText: 'Done' });
    
    await waitFor(() => {
      expect(getByText('🎲 Get Game Setup')).toBeTruthy();
    });
  });

  it('handles singular player count correctly', async () => {
    const { getByTestId, getByText } = render(<GameSetupScreen />);

    // Wait for hydration to complete
    await waitFor(() => {
      expect(getByText('4 Players')).toBeTruthy();
    });
    
    // Manually set player count to 1 through Alert mock
    const pickerButton = getByTestId('player-count-picker');
    fireEvent.press(pickerButton);
    
    // Get the Alert.alert call and invoke the first option (1 player)
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const pickerCall = alertCalls.find((c: any[]) => c[0] === 'Select Number of Players');
    const buttons = pickerCall![2];
    const onePlayerButton = buttons.find((b: any) => b.text === '1');
    
    // Wrap the state update in act()
    await act(async () => {
      if (onePlayerButton?.onPress) {
        onePlayerButton.onPress();
      }
    });
    
    // Verify the picker shows "1 Player" (singular)
    await waitFor(() => {
      expect(getByText('1 Player')).toBeTruthy();
    });
  });

  describe('persistence', () => {
    it('restores persisted game name, player count, and response on mount', async () => {
      mockAppCache.getGameSetupGameName.mockResolvedValueOnce('Catan');
      mockAppCache.getGameSetupPlayerCount.mockResolvedValueOnce(3);
      mockAppCache.getGameSetupResponse.mockResolvedValueOnce('Saved setup instructions...');

      const { getByTestId, getByText } = render(<GameSetupScreen />);

      await waitFor(() => {
        expect(getByTestId('game-name-input').props.value).toBe('Catan');
        expect(getByText('3 Players')).toBeTruthy();
        expect(getByText('Saved setup instructions...')).toBeTruthy();
      });
    });

    it('persists response after successful API call', async () => {
      const mockResponse = 'Setup instructions for Catan...';
      mockGetRecommendations.mockResolvedValueOnce({ responseText: mockResponse });

      const { getByTestId } = render(<GameSetupScreen />);

      // Wait for hydration
      await waitFor(() => {
        expect(mockAppCache.getGameSetupGameName).toHaveBeenCalled();
      });

      fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
      fireEvent.press(getByTestId('get-setup-button'));

      await waitFor(() => {
        expect(mockAppCache.setGameSetupResponse).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('clears persisted state when reset is pressed', async () => {
      mockGetRecommendations.mockResolvedValueOnce({ responseText: 'Setup...' });

      const { getByTestId } = render(<GameSetupScreen />);

      // Wait for hydration
      await waitFor(() => {
        expect(mockAppCache.getGameSetupGameName).toHaveBeenCalled();
      });

      fireEvent.changeText(getByTestId('game-name-input'), 'Catan');
      fireEvent.press(getByTestId('get-setup-button'));

      await waitFor(() => {
        expect(getByTestId('reset-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('reset-button'));

      await waitFor(() => {
        expect(mockAppCache.clearGameSetup).toHaveBeenCalled();
      });
    });

    it('does not persist state before hydration completes', async () => {
      // Make hydration slow
      let resolveHydration: (value: string) => void;
      mockAppCache.getGameSetupGameName.mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveHydration = resolve;
        })
      );

      render(<GameSetupScreen />);

      // Before hydration, setters should not have been called
      expect(mockAppCache.setGameSetupGameName).not.toHaveBeenCalled();
      expect(mockAppCache.setGameSetupPlayerCount).not.toHaveBeenCalled();

      // Complete hydration
      await act(async () => {
        resolveHydration!('');
      });
    });
  });
});
