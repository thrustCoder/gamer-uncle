import { useRef, useCallback } from 'react';
import { NavigationState } from '@react-navigation/native';
import { trackScreenView } from '../services/Telemetry';

/**
 * Returns a React Navigation `onStateChange` handler that automatically
 * fires a `Screen.Viewed` telemetry event whenever the active route changes.
 *
 * Usage in App.tsx:
 * ```tsx
 * const { onNavigationStateChange } = useAnalytics();
 * <NavigationContainer onStateChange={onNavigationStateChange}>
 * ```
 */
export const useAnalytics = () => {
  const currentRouteRef = useRef<string | undefined>(undefined);

  const onNavigationStateChange = useCallback((state: NavigationState | undefined) => {
    if (!state) return;

    const currentRoute = getActiveRouteName(state);
    if (currentRoute && currentRoute !== currentRouteRef.current) {
      currentRouteRef.current = currentRoute;
      trackScreenView(currentRoute);
    }
  }, []);

  return { onNavigationStateChange };
};

/**
 * Recursively resolve the active route name from a nested navigation state.
 */
function getActiveRouteName(state: NavigationState): string | undefined {
  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state as NavigationState);
  }
  return route.name;
}
