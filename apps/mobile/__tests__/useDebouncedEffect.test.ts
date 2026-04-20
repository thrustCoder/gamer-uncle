import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';

// Helper: wraps a hook that calls useDebouncedEffect so we can control deps
function useTestHook(callback: jest.Mock, deps: any[], delay?: number) {
  useDebouncedEffect(callback, deps, delay);
}

describe('useDebouncedEffect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not call effect immediately', () => {
    const effect = jest.fn();
    renderHook(() => useTestHook(effect, ['value'], 300));

    expect(effect).not.toHaveBeenCalled();
  });

  it('should call effect after delay', () => {
    const effect = jest.fn();
    renderHook(() => useTestHook(effect, ['value'], 300));

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('should use default delay of 300ms', () => {
    const effect = jest.fn();
    renderHook(() => useTestHook(effect, ['value']));

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('should debounce: reset timer when deps change', () => {
    const effect = jest.fn();
    let dep = 'a';

    const { rerender } = renderHook(() => useTestHook(effect, [dep], 300));

    // Advance 200ms (not yet fired)
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(effect).not.toHaveBeenCalled();

    // Change dep — should reset timer
    dep = 'b';
    rerender({});

    // Advance another 200ms (still within new timer)
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(effect).not.toHaveBeenCalled();

    // Advance remaining 100ms — now fires
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('should call cleanup from previous effect before running new one', () => {
    const cleanup = jest.fn();
    const effect = jest.fn(() => cleanup);
    let dep = 'a';

    const { rerender } = renderHook(() => useTestHook(effect, [dep], 100));

    // Fire first effect
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(effect).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();

    // Change deps and fire second effect
    dep = 'b';
    rerender({});

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Previous cleanup should have been called before new effect
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('should call cleanup on unmount', () => {
    const cleanup = jest.fn();
    const effect = jest.fn(() => cleanup);

    const { unmount } = renderHook(() => useTestHook(effect, ['value'], 100));

    // Fire the effect
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(effect).toHaveBeenCalledTimes(1);

    // Unmount should trigger cleanup
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending timer on unmount', () => {
    const effect = jest.fn();

    const { unmount } = renderHook(() => useTestHook(effect, ['value'], 300));

    // Unmount before timer fires
    unmount();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(effect).not.toHaveBeenCalled();
  });

  it('should respect custom delay', () => {
    const effect = jest.fn();
    renderHook(() => useTestHook(effect, ['value'], 1000));

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(effect).toHaveBeenCalledTimes(1);
  });
});
