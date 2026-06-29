import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import NumberPickerModal from '../components/NumberPickerModal';

describe('NumberPickerModal', () => {
  const baseProps = {
    visible: true,
    title: 'Select Number of Players',
    minValue: 2,
    maxValue: 6,
    onSelect: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title and every option in the inclusive range', () => {
    const { getByText, getByTestId } = render(<NumberPickerModal {...baseProps} />);

    expect(getByTestId('number-picker-modal')).toBeTruthy();
    expect(getByText('Select Number of Players')).toBeTruthy();
    // 2..6 inclusive
    expect(getByTestId('number-picker-option-2')).toBeTruthy();
    expect(getByTestId('number-picker-option-6')).toBeTruthy();
  });

  it('does not render an option outside the range', () => {
    const { queryByTestId } = render(<NumberPickerModal {...baseProps} />);

    expect(queryByTestId('number-picker-option-1')).toBeNull();
    expect(queryByTestId('number-picker-option-7')).toBeNull();
  });

  it('calls onSelect then onClose when an option is pressed', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <NumberPickerModal {...baseProps} onSelect={onSelect} onClose={onClose} />
    );

    fireEvent.press(getByTestId('number-picker-option-4'));

    expect(onSelect).toHaveBeenCalledWith(4);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the cancel button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<NumberPickerModal {...baseProps} onClose={onClose} />);

    fireEvent.press(getByTestId('number-picker-cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop overlay is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<NumberPickerModal {...baseProps} onClose={onClose} />);

    fireEvent.press(getByTestId('number-picker-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a single option when min equals max', () => {
    const { getByTestId, queryByTestId } = render(
      <NumberPickerModal {...baseProps} minValue={2} maxValue={2} />
    );

    expect(getByTestId('number-picker-option-2')).toBeTruthy();
    expect(queryByTestId('number-picker-option-3')).toBeNull();
  });
});
