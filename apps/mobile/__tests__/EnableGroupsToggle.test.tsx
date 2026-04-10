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
      'Create Player Groups',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('should display "Create player groups" label text', async () => {
    const onEnabled = jest.fn();
    const { getByText } = renderWithProvider(
      <EnableGroupsToggle onEnabled={onEnabled} />
    );

    await waitFor(() => {
      expect(getByText('Create player groups')).toBeTruthy();
    });
  });

  it('should render the switch component', async () => {
    const onEnabled = jest.fn();
    const { getByTestId } = renderWithProvider(
      <EnableGroupsToggle onEnabled={onEnabled} />
    );

    await waitFor(() => {
      expect(getByTestId('enable-groups-switch')).toBeTruthy();
    });
  });

  it('should show confirmation with Cancel and Confirm buttons', async () => {
    const onEnabled = jest.fn();
    const { getByTestId } = renderWithProvider(
      <EnableGroupsToggle onEnabled={onEnabled} />
    );

    await waitFor(() => {
      expect(getByTestId('enable-groups-toggle')).toBeTruthy();
    });

    fireEvent.press(getByTestId('enable-groups-toggle'));

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Cancel');
    expect(buttons[1].text).toBe('Confirm');
  });
});
