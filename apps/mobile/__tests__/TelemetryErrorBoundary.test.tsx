import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import TelemetryErrorBoundary from '../components/TelemetryErrorBoundary';
import { trackEvent } from '../services/Telemetry';

// Mock Telemetry
jest.mock('../services/Telemetry', () => ({
  trackEvent: jest.fn(),
}));

// A component that throws during render
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render crash');
  }
  return <Text testID="child-content">Normal content</Text>;
}

// A component that renders normally
function SafeComponent() {
  return <Text testID="child-content">Safe content</Text>;
}

describe('TelemetryErrorBoundary', () => {
  // Suppress console.error for expected error boundary logs
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when no error occurs', () => {
    const { getByTestId } = render(
      <TelemetryErrorBoundary errorEventName="Error.Timer" screenName="Timer">
        <SafeComponent />
      </TelemetryErrorBoundary>
    );

    expect(getByTestId('child-content')).toBeTruthy();
  });

  it('renders fallback UI when a child throws', () => {
    const { getByText, queryByTestId } = render(
      <TelemetryErrorBoundary errorEventName="Error.Timer" screenName="Timer">
        <ThrowingComponent />
      </TelemetryErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('The Timer feature encountered an error.')).toBeTruthy();
    expect(queryByTestId('child-content')).toBeNull();
  });

  it('fires trackEvent with correct error event name and properties', () => {
    render(
      <TelemetryErrorBoundary errorEventName="Error.DiceRoller" screenName="Dice Roller">
        <ThrowingComponent />
      </TelemetryErrorBoundary>
    );

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('Error.DiceRoller', {
      screen: 'Dice Roller',
      error: 'Test render crash',
      componentStack: expect.any(String),
    });
  });

  it('shows retry button that resets the error state', () => {
    // We need a component that can toggle between throwing and not throwing
    let shouldThrow = true;

    function ConditionalThrow() {
      if (shouldThrow) {
        throw new Error('Temporary error');
      }
      return <Text testID="child-content">Recovered!</Text>;
    }

    const { getByTestId, getByText } = render(
      <TelemetryErrorBoundary errorEventName="Error.Timer" screenName="Timer">
        <ConditionalThrow />
      </TelemetryErrorBoundary>
    );

    // Should show error UI
    expect(getByText('Something went wrong')).toBeTruthy();

    // Fix the component before retrying
    shouldThrow = false;

    // Press retry
    fireEvent.press(getByTestId('error-boundary-retry'));

    // Should now render the child
    expect(getByTestId('child-content')).toBeTruthy();
    expect(getByText('Recovered!')).toBeTruthy();
  });

  it('truncates componentStack to 500 characters', () => {
    render(
      <TelemetryErrorBoundary errorEventName="Error.ScoreTracker" screenName="Score Tracker">
        <ThrowingComponent />
      </TelemetryErrorBoundary>
    );

    const call = (trackEvent as jest.Mock).mock.calls[0];
    const props = call[1];
    expect(props.componentStack.length).toBeLessThanOrEqual(500);
  });

  it('handles errors with no message gracefully', () => {
    function ThrowNoMessage(): React.ReactElement {
      throw new Error();
      return <Text>never</Text>;
    }

    render(
      <TelemetryErrorBoundary errorEventName="Error.Timer" screenName="Timer">
        <ThrowNoMessage />
      </TelemetryErrorBoundary>
    );

    expect(trackEvent).toHaveBeenCalledWith('Error.Timer', expect.objectContaining({
      screen: 'Timer',
    }));
  });

  it('uses correct screen name in fallback message for different screens', () => {
    const screens = [
      { eventName: 'Error.TeamRandomizer', screenName: 'Team Randomizer' },
      { eventName: 'Error.TurnSelector', screenName: 'Turn Selector' },
      { eventName: 'Error.GameSetup', screenName: 'Game Setup' },
    ];

    for (const { eventName, screenName } of screens) {
      const { getByText, unmount } = render(
        <TelemetryErrorBoundary errorEventName={eventName} screenName={screenName}>
          <ThrowingComponent />
        </TelemetryErrorBoundary>
      );

      expect(getByText(`The ${screenName} feature encountered an error.`)).toBeTruthy();
      unmount();
    }
  });
});
