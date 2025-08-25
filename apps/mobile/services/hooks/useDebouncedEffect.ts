import { useEffect, useRef } from 'react';

/**
 * Runs the effect after `delay` ms of no changes to deps; cancels pending on change/unmount.
 */
export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: any[],
  delay = 300
) {
  const cleanupRef = useRef<void | (() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      if (cleanupRef.current) {
        // run previous cleanup if any
        cleanupRef.current();
      }
      cleanupRef.current = effect();
    }, delay);

    return () => {
  if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);

  // run cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);
}
