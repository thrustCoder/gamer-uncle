import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mock KeyboardAvoidingView by mocking the specific component path
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props, props.children),
  };
});

import GameSearchScreen from '../screens/GameSearchScreen';

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

// Mock StarRating
jest.mock('../components/StarRating', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockStarRating({ rating }: { rating: number }) {
    return React.createElement(Text, { testID: 'star-rating' }, `★ ${(rating / 2).toFixed(1)}`);
  };
});

// Mock GameSearchService
const mockSearchGames = jest.fn();
const mockGetGameDetails = jest.fn();
jest.mock('../services/GameSearchService', () => ({
  __esModule: true,
  default: {
    searchGames: (...args: any[]) => mockSearchGames(...args),
    getGameDetails: (...args: any[]) => mockGetGameDetails(...args),
  },
  gameSearchService: {
    searchGames: (...args: any[]) => mockSearchGames(...args),
    getGameDetails: (...args: any[]) => mockGetGameDetails(...args),
  },
}));

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
}));

describe('GameSearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly with initial state', () => {
    const { getByText, getByTestId, getByPlaceholderText } = render(<GameSearchScreen />);
    
    expect(getByText('Game Search')).toBeTruthy();
    expect(getByText('Find information about any board game')).toBeTruthy();
    expect(getByPlaceholderText('Type game name...')).toBeTruthy();
    expect(getByText(/Start typing to search/)).toBeTruthy();
  });

  it('updates search input on text change', () => {
    const { getByTestId } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'cat');
    
    expect(input.props.value).toBe('cat');
  });

  it('does not search with less than 3 characters', async () => {
    const { getByTestId } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'ca');
    
    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(500);
    });
    
    expect(mockSearchGames).not.toHaveBeenCalled();
  });

  it('triggers search after debounce with 3+ characters', async () => {
    mockSearchGames.mockResolvedValue({
      results: [
        { id: 'bgg-13', name: 'Catan', averageRating: 7.1, minPlayers: 3, maxPlayers: 4 }
      ],
      totalCount: 1
    });

    const { getByTestId } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'catan');
    
    // Advance past debounce (300ms)
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      expect(mockSearchGames).toHaveBeenCalledWith('catan');
    });
  });

  it('displays search results', async () => {
    mockSearchGames.mockResolvedValue({
      results: [
        { id: 'bgg-13', name: 'Catan', averageRating: 7.1, minPlayers: 3, maxPlayers: 4 },
        { id: 'bgg-822', name: 'Carcassonne', averageRating: 7.4, minPlayers: 2, maxPlayers: 5 }
      ],
      totalCount: 2
    });

    const { getByTestId, getByText } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'cat');
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      expect(getByText('Catan')).toBeTruthy();
    });
  });

  it('shows no results message when search returns empty', async () => {
    mockSearchGames.mockResolvedValue({
      results: [],
      totalCount: 0
    });

    const { getByTestId, getByText } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'xyznonexistent');
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      expect(getByText("We couldn't find a game matching your search.")).toBeTruthy();
    });
  });

  it('shows error message on search failure', async () => {
    mockSearchGames.mockRejectedValue(new Error('Network error'));

    const { getByTestId, getByText } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'catan');
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      expect(getByText('Network error')).toBeTruthy();
    });
  });

  it('clears search when clear button is pressed', async () => {
    mockSearchGames.mockResolvedValue({
      results: [{ id: 'bgg-13', name: 'Catan', averageRating: 7.1, minPlayers: 3, maxPlayers: 4 }],
      totalCount: 1
    });

    const { getByTestId, queryByText, getByText } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'catan');
    
    // Advance timers for debounce and flush promises for async search
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve(); // Let the search promise resolve
    });
    
    // Verify search results appear
    expect(getByText('Catan')).toBeTruthy();

    // Clear by setting empty text
    fireEvent.changeText(input, '');
    
    // Advance timers for debounce to update, which triggers the effect to clear results
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    // Results should be cleared (less than 3 chars triggers setSearchResults([]))
    expect(queryByText('Catan')).toBeNull();
  });

  it('navigates to chat with game context on "Ask Uncle" button', async () => {
    mockSearchGames.mockResolvedValue({
      results: [],
      totalCount: 0
    });

    const { getByTestId } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'xyzgame');
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      const askButton = getByTestId('ask-uncle-no-results');
      fireEvent.press(askButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('Chat', {
      prefillContext: {
        searchQuery: 'xyzgame',
        fromGameSearchNoResults: true,
      },
    });
  });

  it('loads and displays game details when selecting a search result', async () => {
    mockSearchGames.mockResolvedValue({
      results: [{ id: 'bgg-13', name: 'Catan', averageRating: 7.1, minPlayers: 3, maxPlayers: 4 }],
      totalCount: 1
    });
    
    mockGetGameDetails.mockResolvedValue({
      id: 'bgg-13',
      name: 'Catan',
      overview: 'Trade and build on the island of Catan',
      averageRating: 7.1,
      bggRating: 7.0,
      numVotes: 98234,
      minPlayers: 3,
      maxPlayers: 4,
      ageRequirement: 10,
      rulesUrl: 'https://catan.com/rules'
    });

    const { getByTestId, findByTestId } = render(<GameSearchScreen />);
    
    const input = getByTestId('game-search-input');
    fireEvent.changeText(input, 'catan');
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    // Wait for search results to appear
    const result = await findByTestId('search-result-0');
    
    // Press on the result to load details
    fireEvent.press(result);

    // Verify the details API was called
    await waitFor(() => {
      expect(mockGetGameDetails).toHaveBeenCalledWith('bgg-13');
    });
  });
});
