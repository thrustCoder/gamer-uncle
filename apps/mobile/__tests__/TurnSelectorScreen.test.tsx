import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TurnSelectorScreen from '../screens/TurnSelectorScreen';

// Mock dependencies
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })),
    },
  },
}));

jest.mock('../components/SpinningWheel', () => {
  const MockSpinningWheel = ({ playerNames, onSpinEnd }: any) => {
    return React.createElement('View', {
      testID: 'spinning-wheel',
      children: [
        React.createElement('Text', { key: 'wheel-text' }, 'Mock Spinning Wheel'),
        ...playerNames.map((name: string, index: number) => 
          React.createElement('Text', { 
            key: `player-${index}`,
            testID: `wheel-player-${index}`
          }, name || `P${index + 1}`)
        )
      ]
    });
  };
  return MockSpinningWheel;
});

jest.mock('../components/BackButton', () => {
  const MockBackButton = () => React.createElement('View', { testID: 'back-button' }, null);
  return MockBackButton;
});

jest.mock('../services/storage/appCache', () => ({
  appCache: {
    getPlayerCount: jest.fn(() => Promise.resolve(4)),
    getPlayers: jest.fn(() => Promise.resolve([])),
    setPlayerCount: jest.fn(),
    setPlayers: jest.fn(),
  },
}));

jest.mock('../services/hooks/useDebouncedEffect', () => ({
  useDebouncedEffect: (callback: () => void, deps: any[], delay: number) => {
    React.useEffect(callback, deps);
  },
}));

describe('TurnSelectorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow clearing player names without auto-populating', async () => {
    const { getAllByDisplayValue, queryByDisplayValue } = render(<TurnSelectorScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Get the first text input
    const inputs = getAllByDisplayValue(/P\d+/);
    const firstInput = inputs[0];

    // Clear the input
    fireEvent.changeText(firstInput, '');

    // Verify the input is empty and stays empty
    await waitFor(() => {
      expect(queryByDisplayValue('P1')).toBeNull();
    });
    
    // The input should remain empty
    expect(firstInput.props.value).toBe('');
  });

  it('should allow setting custom names after clearing', async () => {
    const { getAllByDisplayValue, getByDisplayValue } = render(<TurnSelectorScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Get the first text input
    const inputs = getAllByDisplayValue(/P\d+/);
    const firstInput = inputs[0];

    // Clear the input and set a custom name
    fireEvent.changeText(firstInput, '');
    fireEvent.changeText(firstInput, 'Alice');

    // Verify the custom name is set
    await waitFor(() => {
      expect(getByDisplayValue('Alice')).toBeTruthy();
    });
  });

  it('should display placeholder names on spinning wheel when inputs are empty', async () => {
    const { getAllByDisplayValue, getByTestId } = render(<TurnSelectorScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Clear the first input
    const inputs = getAllByDisplayValue(/P\d+/);
    const firstInput = inputs[0];
    fireEvent.changeText(firstInput, '');

    // The spinning wheel should still show P1 for empty input
    await waitFor(() => {
      const wheelPlayer = getByTestId('wheel-player-0');
      expect(wheelPlayer.props.children).toBe('P1');
    });
  });

  it('should show custom names in spinning wheel when inputs have values', async () => {
    const { getAllByDisplayValue, getByTestId } = render(<TurnSelectorScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Set custom name for first input
    const inputs = getAllByDisplayValue(/P\d+/);
    const firstInput = inputs[0];
    fireEvent.changeText(firstInput, 'Alice');

    // The spinning wheel should show the custom name
    await waitFor(() => {
      const wheelPlayer = getByTestId('wheel-player-0');
      expect(wheelPlayer.props.children).toBe('Alice');
    });
  });

  it('should handle mixed empty and custom names correctly', async () => {
    const { getAllByDisplayValue, getByTestId } = render(<TurnSelectorScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Set custom name for first input, clear second input
    const inputs = getAllByDisplayValue(/P\d+/);
    fireEvent.changeText(inputs[0], 'Alice');
    fireEvent.changeText(inputs[1], '');

    // Verify wheel shows correct names
    await waitFor(() => {
      expect(getByTestId('wheel-player-0').props.children).toBe('Alice');
      expect(getByTestId('wheel-player-1').props.children).toBe('P2'); // Fallback for empty
    });
  });
});
