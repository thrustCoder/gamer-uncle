import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import EnableGroupsToggle from '../components/EnableGroupsToggle';
import { PlayerGroupsProvider } from '../store/PlayerGroupsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.spyOn(Alert, 'alert');

const renderWithProvider = (ui: React.ReactElement) =>
  render(<PlayerGroupsProvider>{ui}</PlayerGroupsProvider>);

describe('EnableGroupsToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('should render the toggle', async () => {
    const onEnabled = jest.fn();
    const { getByTestId } = renderWithProvider(
      <EnableGroupsToggle onEnabled={onEnabled} />
    );

    await waitFor(() => {
      expect(getByTestId('enable-groups-toggle')).toBeTruthy();
    });
  });

  it('should show confirmation alert on press', async () => {
    const onEnabled = jest.fn();
    const { getByTestId } = renderWithProvider(
      <EnableGroupsToggle onEnabled={onEnabled} />
    );

    await waitFor(() => {
      expect(getByTestId('enable-groups-toggle')).toBeTruthy();
    });

    fireEvent.press(getByTestId('enable-groups-toggle'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Enable Player Groups',
      expect.any(String),
      expect.any(Array),
    );
  });
});
