import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

// Mock API client
const mockGetRecommendations = jest.fn();
jest.mock('../services/ApiClient', () => ({
  getRecommendations: (...args: any[]) => mockGetRecommendations(...args),
}));

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
      response: 'Setup instructions for Catan...',
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
    });
  });

  it('displays response after successful API call', async () => {
    const mockResponse = 'Setup instructions for Catan with 4 players:\n1. Place the board...';
    mockGetRecommendations.mockResolvedValueOnce({
      response: mockResponse,
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
      response: 'Setup instructions...',
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
      response: 'Setup instructions...',
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

  it('resets form when "New Game" button is pressed', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      response: 'Setup instructions...',
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
    resolvePromise!({ response: 'Done' });
    
    await waitFor(() => {
      expect(getByText('🎲 Get Game Setup')).toBeTruthy();
    });
  });

  it('handles singular player count correctly', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      response: 'Single player setup...',
    });

    const { getByTestId, getByText } = render(<GameSetupScreen />);
    
    // Manually set player count to 1 through Alert mock
    // Since Alert.alert is async/callback based, we need to trigger the callback
    const pickerButton = getByTestId('player-count-picker');
    fireEvent.press(pickerButton);
    
    // Get the Alert.alert call and invoke the first option (1 player)
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const onePlayerButton = buttons.find((b: any) => b.text === '1');
    if (onePlayerButton?.onPress) {
      onePlayerButton.onPress();
    }
    
    // Verify the picker shows "1 Player" (singular)
    expect(getByText('1 Player')).toBeTruthy();
  });
});
