import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import DirectionToggle from '../components/turnTracker/DirectionToggle';

describe('DirectionToggle', () => {
  it('renders both segments and marks the active one', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DirectionToggle value="cw" onChange={onChange} />);
    expect(getByTestId('direction-cw')).toBeTruthy();
    expect(getByTestId('direction-ccw')).toBeTruthy();
  });

  it('invokes onChange when the inactive segment is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DirectionToggle value="cw" onChange={onChange} />);
    fireEvent.press(getByTestId('direction-ccw'));
    expect(onChange).toHaveBeenCalledWith('ccw');
  });

  it('still invokes onChange when the active segment is pressed (caller decides whether to no-op)', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DirectionToggle value="cw" onChange={onChange} />);
    fireEvent.press(getByTestId('direction-cw'));
    expect(onChange).toHaveBeenCalledWith('cw');
  });
});
