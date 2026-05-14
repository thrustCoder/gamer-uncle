import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
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

// Quiet the tick-sound side effect so audio mocks don't pollute logs.
jest.mock('../services/turnTrackerSound', () => ({
  playTurnTickSound: jest.fn(),
  unloadTurnTickSound: jest.fn(),
}));

// GroupPicker pulls in icon assets we don't need to render here.
jest.mock('../components/GroupPicker', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'group-picker' });
});

// TurnMarker pulls in react-native-svg which doesn't render reliably under
// jest with the SVG mock. We only care about the marker's tap surface in
// screen-level tests; the SVG geometry is exercised separately.
jest.mock('../components/turnTracker/TurnMarker', () => {
  const React = require('react');
  const { TouchableOpacity } = require('react-native');
  const MockTurnMarker = ({ onPress, testID }: any) =>
    React.createElement(
      TouchableOpacity,
      { onPress, testID: testID ?? 'turn-marker', accessibilityRole: 'button' },
      null
    );
  return {
    __esModule: true,
    default: MockTurnMarker,
    shortestAngleDelta: jest.fn(),
  };
});

const renderScreen = () =>
  render(
    <PlayerGroupsProvider>
      <TurnTrackerProvider>
        <TurnTrackerScreen />
      </TurnTrackerProvider>
    </PlayerGroupsProvider>
  );

const seedAppCache = (
  playerCount: number,
  playerNames: string[],
): void => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
    if (key === 'app.playerCount') return Promise.resolve(String(playerCount));
    if (key === 'app.playersList') return Promise.resolve(JSON.stringify(playerNames));
    return Promise.resolve(null);
  });
};

/**
 * Fill every seat in the setup view by repeatedly opening the picker and
 * selecting the next available player. Assumes the seating circle is rendered
 * for `playerCount` players and that all players start unseated.
 */
const fillAllSeats = (api: ReturnType<typeof renderScreen>, playerCount: number) => {
  for (let i = 0; i < playerCount; i += 1) {
    fireEvent.press(api.getByTestId(`seat-${i}-touch`));
    fireEvent.press(api.getByTestId(`player-picker-row-${i}`));
  }
};

describe('TurnTrackerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedAppCache(4, ['Alice', 'Bob', 'Carol', 'Dave']);
  });

  describe('Setup mode', () => {
    it('renders the page header and the Pick Turn CTA when no seats are filled', async () => {
      const { getByText, getByTestId } = renderScreen();

      await waitFor(() => {
        expect(getByTestId('cta-pick-turn')).toBeTruthy();
      });
      expect(getByText('Track Turns')).toBeTruthy();
      expect(getByTestId('seating-circle')).toBeTruthy();
    });

    it('Pick Turn CTA navigates to the Turn route', async () => {
      const { getByTestId } = renderScreen();
      await waitFor(() => getByTestId('cta-pick-turn'));

      fireEvent.press(getByTestId('cta-pick-turn'));
      expect(mockNavigate).toHaveBeenCalledWith('Turn');
    });

    it('Begin Game button is disabled until all seats are filled', async () => {
      const { getByTestId } = renderScreen();
      await waitFor(() => getByTestId('begin-game-button'));

      const beginBtn = getByTestId('begin-game-button');
      const isDisabled =
        beginBtn.props.accessibilityState?.disabled ?? beginBtn.props.disabled;
      expect(isDisabled).toBeTruthy();
    });

    it('tapping a seat opens the player picker for that seat', async () => {
      const { getByTestId, queryByTestId } = renderScreen();
      await waitFor(() => getByTestId('cta-pick-turn'));

      // Picker is hidden initially
      expect(queryByTestId('player-picker-row-0')).toBeNull();

      fireEvent.press(getByTestId('seat-1-touch'));

      // After tapping seat #2 (zero-indexed 1), the picker is visible.
      expect(getByTestId('player-picker-row-0')).toBeTruthy();
      expect(getByTestId('player-picker-cancel')).toBeTruthy();
    });

    it('selecting a player in the picker assigns them to the seat and closes the picker', async () => {
      const { getByTestId, queryByTestId } = renderScreen();
      await waitFor(() => getByTestId('cta-pick-turn'));

      fireEvent.press(getByTestId('seat-0-touch'));
      fireEvent.press(getByTestId('player-picker-row-2')); // Carol

      // Picker closes
      expect(queryByTestId('player-picker-row-0')).toBeNull();
      // Pick First Turn CTA disappears once any seat is filled.
      expect(queryByTestId('cta-pick-turn')).toBeNull();
      // Begin Game still disabled (only 1 of 4 filled).
      const beginBtn = getByTestId('begin-game-button');
      const isDisabled =
        beginBtn.props.accessibilityState?.disabled ?? beginBtn.props.disabled;
      expect(isDisabled).toBeTruthy();
    });

    it('pressing Cancel in the picker closes it without changing seats', async () => {
      const { getByTestId, queryByTestId } = renderScreen();
      await waitFor(() => getByTestId('cta-pick-turn'));

      fireEvent.press(getByTestId('seat-0-touch'));
      fireEvent.press(getByTestId('player-picker-cancel'));

      expect(queryByTestId('player-picker-cancel')).toBeNull();
      // Pick First Turn CTA is still showing because no seat was filled.
      expect(getByTestId('cta-pick-turn')).toBeTruthy();
    });

    it('shows the "Add 2-20 players" copy when the roster is too small', async () => {
      seedAppCache(1, ['Solo']);
      const { findByText, queryByTestId } = renderScreen();

      await findByText(/Add 2.20 players/i);
      // Seating circle and Begin Game are not rendered for invalid counts.
      expect(queryByTestId('seating-circle')).toBeNull();
      expect(queryByTestId('begin-game-button')).toBeNull();
    });
  });

  describe('Begin → In-game → End', () => {
    beforeEach(() => {
      // Use 2 players for fast seat-filling.
      seedAppCache(2, ['Alice', 'Bob']);
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
      (Alert.alert as jest.Mock).mockRestore?.();
    });

    it('Begin Game becomes enabled after all seats are filled and starts the game', async () => {
      const api = renderScreen();
      await waitFor(() => api.getByTestId('begin-game-button'));

      fillAllSeats(api, 2);

      const beginBtn = api.getByTestId('begin-game-button');
      const isDisabled =
        beginBtn.props.accessibilityState?.disabled ?? beginBtn.props.disabled;
      expect(isDisabled).toBeFalsy();

      fireEvent.press(beginBtn);

      // In-game view appears: direction toggle, advance/timer/end CTAs.
      await waitFor(() => api.getByTestId('end-game-button'));
      expect(api.getByTestId('direction-toggle')).toBeTruthy();
      expect(api.getByTestId('cta-add-game-score')).toBeTruthy();
      expect(api.getByTestId('cta-timer')).toBeTruthy();
      expect(api.getByTestId('turn-marker')).toBeTruthy();
    });

    it('in-game CTAs navigate to ScoreTracker and Timer', async () => {
      const api = renderScreen();
      await waitFor(() => api.getByTestId('begin-game-button'));
      fillAllSeats(api, 2);
      fireEvent.press(api.getByTestId('begin-game-button'));
      await waitFor(() => api.getByTestId('end-game-button'));

      fireEvent.press(api.getByTestId('cta-add-game-score'));
      expect(mockNavigate).toHaveBeenCalledWith('ScoreTracker');

      fireEvent.press(api.getByTestId('cta-timer'));
      expect(mockNavigate).toHaveBeenCalledWith('Timer');
    });

    it('switching the direction toggle updates the active direction', async () => {
      const api = renderScreen();
      await waitFor(() => api.getByTestId('begin-game-button'));
      fillAllSeats(api, 2);
      fireEvent.press(api.getByTestId('begin-game-button'));
      await waitFor(() => api.getByTestId('direction-ccw'));

      // ccw is initially un-selected (game starts cw); after tap it becomes selected.
      fireEvent.press(api.getByTestId('direction-ccw'));
      await waitFor(() => {
        expect(api.getByTestId('direction-ccw').props.accessibilityState?.selected).toBe(true);
      });
      expect(api.getByTestId('direction-cw').props.accessibilityState?.selected).toBe(false);
    });

    it('End Game opens a confirmation Alert and clears the session when confirmed', async () => {
      const api = renderScreen();
      await waitFor(() => api.getByTestId('begin-game-button'));
      fillAllSeats(api, 2);
      fireEvent.press(api.getByTestId('begin-game-button'));
      await waitFor(() => api.getByTestId('end-game-button'));

      fireEvent.press(api.getByTestId('end-game-button'));
      expect(Alert.alert).toHaveBeenCalledTimes(1);

      // Simulate the user pressing the destructive "End" button.
      const lastCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = lastCall[2] as Array<{ text: string; onPress?: () => void }>;
      const endBtn = buttons.find((b) => b.text === 'End');
      expect(endBtn).toBeTruthy();
      await act(async () => {
        endBtn?.onPress?.();
      });

      // After ending, the in-game CTAs disappear and the setup view returns.
      await waitFor(() => {
        expect(api.queryByTestId('end-game-button')).toBeNull();
      });
      expect(api.getByTestId('cta-pick-turn')).toBeTruthy();
    });

    it('tapping the central turn marker advances the turn (active seat changes)', async () => {
      const api = renderScreen();
      await waitFor(() => api.getByTestId('begin-game-button'));
      fillAllSeats(api, 2);
      fireEvent.press(api.getByTestId('begin-game-button'));
      await waitFor(() => api.getByTestId('turn-marker'));

      // With 2 players, advancing once flips active from seat 0 → seat 1.
      // After the advance, seat 0 becomes "tap" (it's the prev seat → tap to retract)
      // and seat 1 becomes "active". We assert by checking that seat-0-touch (was active
      // before and untappable) now exists as a touch target.
      expect(api.queryByTestId('seat-0-touch')).toBeNull();
      fireEvent.press(api.getByTestId('turn-marker'));
      await waitFor(() => {
        expect(api.queryByTestId('seat-0-touch')).not.toBeNull();
      });
    });
  });
});
