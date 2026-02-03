import { renderHook, act } from '@testing-library/react-native';
import { useDebounce } from '../hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300));
    expect(result.current).toBe('test');
  });

  it('returns debounced value after delay', () => {
    let value = 'initial';
    const { result, rerender } = renderHook(() => useDebounce(value, 300));

    expect(result.current).toBe('initial');

    // Update the value
    value = 'updated';
    rerender({});

    // Value should still be initial before delay
    expect(result.current).toBe('initial');

    // Fast forward past the delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid value changes', () => {
    let value = 'a';
    const { result, rerender } = renderHook(() => useDebounce(value, 300));

    // Rapid updates
    value = 'ab';
    rerender({});
    act(() => {
      jest.advanceTimersByTime(100);
    });

    value = 'abc';
    rerender({});
    act(() => {
      jest.advanceTimersByTime(100);
    });

    value = 'abcd';
    rerender({});

    // Value should still be initial
    expect(result.current).toBe('a');

    // Fast forward past the delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should have the final value
    expect(result.current).toBe('abcd');
  });

  it('uses default delay of 300ms', () => {
    let value = 'initial';
    const { result, rerender } = renderHook(() => useDebounce(value));

    value = 'updated';
    rerender({});

    // Before default delay
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // After default delay
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('works with number type', () => {
    let value = 1;
    const { result, rerender } = renderHook(() => useDebounce(value, 300));

    value = 42;
    rerender({});
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe(42);
  });

  it('works with object type', () => {
    let value = { name: 'test' };
    const { result, rerender } = renderHook(() => useDebounce(value, 300));

    value = { name: 'updated' };
    rerender({});
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toEqual({ name: 'updated' });
  });
});
