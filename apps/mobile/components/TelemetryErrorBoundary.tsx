import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { trackEvent } from '../services/Telemetry';

interface Props {
  /** The AnalyticsEvents error constant to fire when this screen crashes */
  errorEventName: string;
  /** Human-readable screen name for the error properties */
  screenName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * React error boundary that catches render-time crashes in wrapped screens
 * and fires a telemetry event so Azure Monitor alerts can detect feature failures.
 *
 * Usage in App.tsx:
 * ```tsx
 * <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_TIMER} screenName="Timer">
 *   <TimerScreen />
 * </TelemetryErrorBoundary>
 * ```
 */
export default class TelemetryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    trackEvent(this.props.errorEventName, {
      screen: this.props.screenName,
      error: error.message || 'Unknown error',
      componentStack: errorInfo.componentStack?.substring(0, 500) || '',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The {this.props.screenName} feature encountered an error.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            testID="error-boundary-retry"
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1a2e',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#aaaacc',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
