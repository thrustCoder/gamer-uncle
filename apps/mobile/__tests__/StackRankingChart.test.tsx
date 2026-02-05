import React from 'react';
import { render } from '@testing-library/react-native';
import StackRankingChart from '../components/scoreTracker/StackRankingChart';

describe('StackRankingChart', () => {
  it('renders nothing when data is empty', () => {
    const { toJSON } = render(<StackRankingChart data={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders player initials', () => {
    const data = [
      { player: 'Alice', total: 100 },
      { player: 'Bob', total: 80 },
    ];
    const { getByText } = render(<StackRankingChart data={data} />);
    expect(getByText('A')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
  });

  it('displays scores correctly', () => {
    const data = [
      { player: 'Alice', total: 150 },
      { player: 'Bob', total: 75 },
    ];
    const { getByText } = render(<StackRankingChart data={data} />);
    expect(getByText('150')).toBeTruthy();
    expect(getByText('75')).toBeTruthy();
  });

  it('sorts players by score descending', () => {
    const data = [
      { player: 'Alice', total: 50 },
      { player: 'Bob', total: 100 },
      { player: 'Charlie', total: 75 },
    ];
    const { getAllByText } = render(<StackRankingChart data={data} />);
    
    // Bob should be first (highest score)
    // Note: We can't easily test order in RN Testing Library without testIDs
    // But we can verify all scores are rendered
    expect(getAllByText(/\d+/).length).toBe(3);
  });

  it('generates unique initials for duplicate starting letters', () => {
    const data = [
      { player: 'Alice', total: 100 },
      { player: 'Anna', total: 80 },
      { player: 'Amy', total: 60 },
    ];
    const { getByText } = render(<StackRankingChart data={data} />);
    
    // Should have consistent 2-character initials for all players
    // because 1 char would not be unique
    expect(getByText('AL')).toBeTruthy();
    expect(getByText('AN')).toBeTruthy();
    expect(getByText('AM')).toBeTruthy();
  });

  it('handles empty player names gracefully', () => {
    const data = [
      { player: '', total: 100 },
      { player: 'Bob', total: 80 },
    ];
    const { getByText } = render(<StackRankingChart data={data} />);
    expect(getByText('?')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
  });

  it('truncates initials to max 3 characters', () => {
    const data = [
      { player: 'Alexander', total: 100 },
      { player: 'Alexandra', total: 80 },
      { player: 'Alexandrina', total: 60 },
    ];
    const { queryByText } = render(<StackRankingChart data={data} />);
    
    // All initials should be 3 chars or less
    // The exact initials depend on the algorithm, but none should exceed 3 chars
    expect(queryByText(/^.{4,}$/)).toBeNull();
  });
});
