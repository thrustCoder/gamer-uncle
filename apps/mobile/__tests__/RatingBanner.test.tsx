import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RatingBanner from '../components/RatingBanner';

describe('RatingBanner', () => {
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
      <RatingBanner {...defaultProps} />,
    );

    expect(getByTestId('rating-banner')).toBeTruthy();
    expect(getByText('Enjoying Gamer Uncle? Rate us!')).toBeTruthy();
    expect(getByText('Rate')).toBeTruthy();
    expect(getByText('✕')).toBeTruthy();
  });

  it('returns null when visible is false and has never been shown', () => {
    const { queryByTestId } = render(
      <RatingBanner {...defaultProps} visible={false} />,
    );

    expect(queryByTestId('rating-banner')).toBeNull();
  });

  it('calls onRate when Rate button is pressed', () => {
    const onRate = jest.fn();
    const { getByTestId } = render(
      <RatingBanner {...defaultProps} onRate={onRate} />,
    );

    fireEvent.press(getByTestId('rating-banner-rate'));
    expect(onRate).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <RatingBanner {...defaultProps} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId('rating-banner-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has accessibility labels on both action buttons', () => {
    const { getByTestId } = render(
      <RatingBanner {...defaultProps} />,
    );

    const rateButton = getByTestId('rating-banner-rate');
    const dismissButton = getByTestId('rating-banner-dismiss');

    expect(rateButton.props.accessibilityLabel).toBe('Rate the app');
    expect(dismissButton.props.accessibilityLabel).toBe('Dismiss rating prompt');
  });

  it('has accessibilityRole alert on the container', () => {
    const { getByTestId } = render(
      <RatingBanner {...defaultProps} />,
    );

    expect(getByTestId('rating-banner').props.accessibilityRole).toBe('alert');
  });

  it('renders star emoji', () => {
    const { getByText } = render(
      <RatingBanner {...defaultProps} />,
    );

    expect(getByText('⭐')).toBeTruthy();
  });

  it('calls onDismiss when backdrop is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <RatingBanner {...defaultProps} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId('rating-banner-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
