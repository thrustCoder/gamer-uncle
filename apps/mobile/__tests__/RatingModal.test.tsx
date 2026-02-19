import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RatingModal from '../components/RatingModal';

describe('RatingModal', () => {
  const defaultProps = {
    visible: true,
    onRate: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    const { getByTestId, getByText } = render(
      <RatingModal {...defaultProps} />,
    );

    expect(getByTestId('rating-modal')).toBeTruthy();
    expect(getByTestId('rating-modal-card')).toBeTruthy();
    expect(getByText('Enjoying Gamer Uncle?')).toBeTruthy();
    expect(getByText('Your rating helps other gamers discover the app!')).toBeTruthy();
    expect(getByText('Rate Us ⭐')).toBeTruthy();
    expect(getByText('Maybe Later')).toBeTruthy();
  });

  it('returns null when visible is false', () => {
    const { queryByTestId } = render(
      <RatingModal {...defaultProps} visible={false} />,
    );

    expect(queryByTestId('rating-modal')).toBeNull();
  });

  it('calls onRate when Rate Us button is pressed', () => {
    const onRate = jest.fn();
    const { getByTestId } = render(
      <RatingModal {...defaultProps} onRate={onRate} />,
    );

    fireEvent.press(getByTestId('rating-modal-rate'));
    expect(onRate).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when Maybe Later button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <RatingModal {...defaultProps} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId('rating-modal-later'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when close button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <RatingModal {...defaultProps} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId('rating-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when backdrop is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <RatingModal {...defaultProps} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId('rating-modal-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has accessibility labels on action buttons', () => {
    const { getByTestId } = render(
      <RatingModal {...defaultProps} />,
    );

    expect(getByTestId('rating-modal-rate').props.accessibilityLabel).toBe('Rate the app');
    expect(getByTestId('rating-modal-later').props.accessibilityLabel).toBe('Maybe later');
    expect(getByTestId('rating-modal-dismiss').props.accessibilityLabel).toBe('Dismiss rating prompt');
  });

  it('has accessibilityRole alert on the card', () => {
    const { getByTestId } = render(
      <RatingModal {...defaultProps} />,
    );

    expect(getByTestId('rating-modal-card').props.accessibilityRole).toBe('alert');
  });

  it('renders star emoji', () => {
    const { getByText } = render(
      <RatingModal {...defaultProps} />,
    );

    expect(getByText('⭐')).toBeTruthy();
  });
});
