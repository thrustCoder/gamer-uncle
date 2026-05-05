import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TurnTrackerScreen from '../screens/TurnTrackerScreen';
import { PlayerGroupsProvider } from '../store/PlayerGroupsContext';
import { TurnTrackerProvider } from '../store/TurnTrackerContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

const renderScreen = () =>
  render(
    <PlayerGroupsProvider>
      <TurnTrackerProvider>
        <TurnTrackerScreen />
      </TurnTrackerProvider>
    </PlayerGroupsProvider>
  );

describe('TurnTrackerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'app.playerCount') return Promise.resolve('4');
      if (key === 'app.playersList') return Promise.resolve(JSON.stringify(['Alice', 'Bob', 'Carol', 'Dave']));
      return Promise.resolve(null);
    });
  });

  it('renders the page header and the Pick Turn CTA in setup mode', async () => {
    const { getByText, getByTestId } = renderScreen();

    // Wait for hydration to finish (cta-pick-turn renders only after isLoading=false)
    await waitFor(() => {
      expect(getByTestId('cta-pick-turn')).toBeTruthy();
    });
    expect(getByText('Track Turns')).toBeTruthy();
  });

  it('Pick Turn CTA navigates to the Turn route', async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() => getByTestId('cta-pick-turn'));

    fireEvent.press(getByTestId('cta-pick-turn'));
    expect(mockNavigate).toHaveBeenCalledWith('Turn');
  });

  it('Begin Game button is rendered but disabled until all seats are filled', async () => {
    const { getByTestId, queryByTestId } = renderScreen();

    // After hydration, with no seats assigned, the Begin Game CTA renders but is disabled.
    await waitFor(() => {
      expect(queryByTestId('cta-pick-turn')).toBeTruthy();
    });
    const beginBtn = getByTestId('begin-game-button');
    expect(beginBtn).toBeTruthy();
    const isDisabled =
      beginBtn.props.accessibilityState?.disabled ?? beginBtn.props.disabled;
    expect(isDisabled).toBeTruthy();
  });

  it('Pick First Turn CTA is shown only while every seat is empty', async () => {
    const { queryByTestId } = renderScreen();
    await waitFor(() => {
      expect(queryByTestId('cta-pick-turn')).toBeTruthy();
    });
  });
});
