import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TeamRandomizerScreen from '../screens/TeamRandomizerScreen';

// Mock dependencies
jest.mock('react-native-confetti-cannon', () => {
  const MockConfettiCannon = ({ children, ...props }: any) => null;
  return MockConfettiCannon;
});

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })),
    },
  },
}));

jest.mock('../components/BackButton', () => {
  const MockBackButton = () => React.createElement('View', { testID: 'back-button' }, null);
  return MockBackButton;
});

jest.mock('../services/storage/appCache', () => ({
  appCache: {
    getPlayerCount: jest.fn(() => Promise.resolve(4)),
    getTeamCount: jest.fn(() => Promise.resolve(2)),
    getPlayers: jest.fn(() => Promise.resolve([])),
    setPlayerCount: jest.fn(),
    setTeamCount: jest.fn(),
    setPlayers: jest.fn(),
  },
}));

jest.mock('../services/hooks/useDebouncedEffect', () => ({
  useDebouncedEffect: (callback: () => void, deps: any[], delay: number) => {
    React.useEffect(callback, deps);
  },
}));

describe('TeamRandomizerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow clearing player names without auto-populating', async () => {
    const { getAllByDisplayValue, queryByDisplayValue } = render(<TeamRandomizerScreen />);
    
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
    const { getAllByDisplayValue, getByDisplayValue } = render(<TeamRandomizerScreen />);
    
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

  it('should display fallback names in teams when inputs are empty', async () => {
    const { getAllByDisplayValue, getByText } = render(<TeamRandomizerScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Clear first two inputs
    const inputs = getAllByDisplayValue(/P\d+/);
    fireEvent.changeText(inputs[0], '');
    fireEvent.changeText(inputs[1], '');

    // Click randomize button
    const randomizeButton = getByText('RANDOMIZE');
    fireEvent.press(randomizeButton);

    // Teams should display fallback names for empty inputs
    await waitFor(() => {
      expect(getByText('P1')).toBeTruthy();
      expect(getByText('P2')).toBeTruthy();
    });
  });

  it('should maintain custom names in teams when some inputs are custom', async () => {
    const { getAllByDisplayValue, getByText } = render(<TeamRandomizerScreen />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Set custom names for first two, clear third
    const inputs = getAllByDisplayValue(/P\d+/);
    fireEvent.changeText(inputs[0], 'Alice');
    fireEvent.changeText(inputs[1], 'Bob');
    fireEvent.changeText(inputs[2], '');

    // Click randomize button
    const randomizeButton = getByText('RANDOMIZE');
    fireEvent.press(randomizeButton);

    // Teams should display both custom names and fallback names
    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
      expect(getByText('P3')).toBeTruthy(); // Fallback for cleared input
    });
  });

  it('should handle mixed empty and custom names correctly', async () => {
    const { getAllByDisplayValue, getByText } = render(<TeamRandomizerScreen />);
    
    // Wait for component to load  
    await waitFor(() => {
      expect(getAllByDisplayValue(/P\d+/)).toHaveLength(4);
    });

    // Set custom name for first, clear second, keep others default
    const inputs = getAllByDisplayValue(/P\d+/);
    fireEvent.changeText(inputs[0], 'Alice');
    fireEvent.changeText(inputs[1], '');
    // inputs[2] and inputs[3] remain as P3, P4

    // Click randomize button
    const randomizeButton = getByText('RANDOMIZE');
    fireEvent.press(randomizeButton);

    // Verify team composition
    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('P2')).toBeTruthy(); // Fallback for cleared
      expect(getByText('P3')).toBeTruthy(); // Default
      expect(getByText('P4')).toBeTruthy(); // Default
    });
  });
});
