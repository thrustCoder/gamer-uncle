import { renderHook, act } from '@testing-library/react-native';
import { useAnalytics } from '../hooks/useAnalytics';
import { trackScreenView } from '../services/Telemetry';

// Mock the Telemetry service
jest.mock('../services/Telemetry', () => ({
  trackScreenView: jest.fn(),
  AnalyticsEvents: { SCREEN_VIEWED: 'Screen.Viewed' },
}));

describe('useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return onNavigationStateChange callback', () => {
    const { result } = renderHook(() => useAnalytics());
    expect(typeof result.current.onNavigationStateChange).toBe('function');
  });

  it('should track screen view when navigation state changes', () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.onNavigationStateChange({
        index: 0,
        routes: [{ key: 'Landing-1', name: 'Landing' }],
        key: 'stack-1',
        routeNames: ['Landing'],
        stale: false,
        type: 'stack',
      });
    });

    expect(trackScreenView).toHaveBeenCalledWith('Landing');
  });

  it('should not re-track the same screen', () => {
    const { result } = renderHook(() => useAnalytics());

    const state = {
      index: 0,
      routes: [{ key: 'Landing-1', name: 'Landing' }],
      key: 'stack-1',
      routeNames: ['Landing'],
      stale: false as const,
      type: 'stack' as const,
    };

    act(() => {
      result.current.onNavigationStateChange(state);
    });

    act(() => {
      result.current.onNavigationStateChange(state);
    });

    expect(trackScreenView).toHaveBeenCalledTimes(1);
  });

  it('should track when navigating to a different screen', () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.onNavigationStateChange({
        index: 0,
        routes: [{ key: 'Landing-1', name: 'Landing' }],
        key: 'stack-1',
        routeNames: ['Landing', 'Chat'],
        stale: false,
        type: 'stack',
      });
    });

    act(() => {
      result.current.onNavigationStateChange({
        index: 1,
        routes: [
          { key: 'Landing-1', name: 'Landing' },
          { key: 'Chat-1', name: 'Chat' },
        ],
        key: 'stack-1',
        routeNames: ['Landing', 'Chat'],
        stale: false,
        type: 'stack',
      });
    });

    expect(trackScreenView).toHaveBeenCalledTimes(2);
    expect(trackScreenView).toHaveBeenNthCalledWith(1, 'Landing');
    expect(trackScreenView).toHaveBeenNthCalledWith(2, 'Chat');
  });

  it('should handle undefined state gracefully', () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.onNavigationStateChange(undefined as any);
    });

    expect(trackScreenView).not.toHaveBeenCalled();
  });
});
