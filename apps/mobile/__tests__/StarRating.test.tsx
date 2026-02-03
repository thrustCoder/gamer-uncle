import React from 'react';
import { render } from '@testing-library/react-native';
import StarRating from '../components/StarRating';

describe('StarRating', () => {
  it('renders correctly with default props', () => {
    const { getByText, UNSAFE_getAllByType } = render(<StarRating rating={7.0} />);
    
    // Should show the numeric value (7.0 / 2 = 3.5)
    expect(getByText('3.5')).toBeTruthy();
  });

  it('converts 10-point BGG scale to 5-star scale', () => {
    // Rating of 10 should be 5.0 stars
    const { getByText: getText10 } = render(<StarRating rating={10} />);
    expect(getText10('5.0')).toBeTruthy();

    // Rating of 5 should be 2.5 stars
    const { getByText: getText5 } = render(<StarRating rating={5} />);
    expect(getText5('2.5')).toBeTruthy();

    // Rating of 0 should be 0.0 stars
    const { getByText: getText0 } = render(<StarRating rating={0} />);
    expect(getText0('0.0')).toBeTruthy();
  });

  it('respects decimal places setting', () => {
    const { getByText } = render(<StarRating rating={7.33} decimalPlaces={2} />);
    // 7.33 / 2 = 3.665, rounded to 2 decimal places = 3.67
    expect(getByText('3.67')).toBeTruthy();
  });

  it('hides numeric value when showValue is false', () => {
    const { queryByText } = render(<StarRating rating={7.0} showValue={false} />);
    // Should not show the numeric value
    expect(queryByText('3.5')).toBeNull();
  });

  it('shows label when provided', () => {
    const { getByText } = render(<StarRating rating={7.0} label="Rating:" />);
    expect(getByText('Rating:')).toBeTruthy();
  });

  it('handles different maxRating values', () => {
    // If maxRating is 5, then a rating of 5 should give 5.0 stars
    const { getByText } = render(<StarRating rating={4} maxRating={5} />);
    // 4/5 * 5 = 4.0 stars
    expect(getByText('4.0')).toBeTruthy();
  });

  it('handles edge cases', () => {
    // Very small rating
    const { getByText: getTextSmall } = render(<StarRating rating={0.5} />);
    expect(getTextSmall('0.3')).toBeTruthy(); // 0.5 / 2 = 0.25, rounded to 0.3

    // Rating at boundary
    const { getByText: getTextFull } = render(<StarRating rating={10} />);
    expect(getTextFull('5.0')).toBeTruthy();
  });
});
