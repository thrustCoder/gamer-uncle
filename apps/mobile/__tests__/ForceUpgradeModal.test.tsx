import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ForceUpgradeModal from '../components/ForceUpgradeModal';

// Mock Linking
jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));

describe('ForceUpgradeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    const { getByText } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
        message="Please update"
        upgradeUrl="https://example.com"
      />
    );

    expect(getByText('Update Required')).toBeTruthy();
    expect(getByText('Please update')).toBeTruthy();
  });

  it('shows default message when message prop is undefined', () => {
    const { getByText } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
        upgradeUrl="https://example.com"
      />
    );

    expect(getByText('A new version is available. Please update to continue.')).toBeTruthy();
  });

  it('shows Update Now button when upgradeUrl is provided', () => {
    const { getByText } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
        upgradeUrl="https://example.com"
      />
    );

    expect(getByText('Update Now')).toBeTruthy();
  });

  it('does not show Update Now button when upgradeUrl is undefined', () => {
    const { queryByText } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
      />
    );

    expect(queryByText('Update Now')).toBeNull();
  });

  it('opens upgradeUrl when Update Now is pressed', () => {
    const { getByTestId } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
        upgradeUrl="https://apps.apple.com/test"
      />
    );

    fireEvent.press(getByTestId('upgrade-button'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://apps.apple.com/test');
  });

  it('shows Later button when forceUpgrade is false', () => {
    const { getByText } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
        upgradeUrl="https://example.com"
      />
    );

    expect(getByText('Later')).toBeTruthy();
  });

  it('hides Later button when forceUpgrade is true', () => {
    const { queryByText } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={true}
        upgradeUrl="https://example.com"
      />
    );

    expect(queryByText('Later')).toBeNull();
  });

  it('calls onDismiss when Later is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <ForceUpgradeModal
        visible={true}
        forceUpgrade={false}
        upgradeUrl="https://example.com"
        onDismiss={onDismiss}
      />
    );

    fireEvent.press(getByTestId('dismiss-button'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
