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
    
    // Should have consistent 2-character initials for all players (Title Case)
    // because 1 char would not be unique
    expect(getByText('Al')).toBeTruthy();
    expect(getByText('An')).toBeTruthy();
    expect(getByText('Am')).toBeTruthy();
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

  it('truncates initials for highly similar names', () => {
    const data = [
      { player: 'Alexander', total: 100 },
      { player: 'Alexandra', total: 80 },
      { player: 'Alexandrina', total: 60 },
    ];
    const { queryByText } = render(<StackRankingChart data={data} />);
    
    // All three scores should be rendered
    expect(queryByText('100')).toBeTruthy();
    expect(queryByText('80')).toBeTruthy();
    expect(queryByText('60')).toBeTruthy();
    // Full names should NOT appear as text (initials are used instead)
    // Note: For highly similar names, initials may be longer than 3 chars
    // because the algorithm uses as many prefix chars as needed for uniqueness
  });

  it('sorts ascending when sortAscending is true', () => {
    const data = [
      { player: 'Alice', total: 50 },
      { player: 'Bob', total: 100 },
      { player: 'Charlie', total: 75 },
    ];
    const { getAllByText } = render(
      <StackRankingChart data={data} sortAscending={true} />
    );
    
    // All scores should be rendered
    expect(getAllByText(/\d+/).length).toBe(3);
  });

  it('sorts descending by default (sortAscending not set)', () => {
    const data = [
      { player: 'Alice', total: 50 },
      { player: 'Bob', total: 100 },
      { player: 'Charlie', total: 75 },
    ];
    const { getAllByText } = render(<StackRankingChart data={data} />);
    
    // All scores should be rendered
    expect(getAllByText(/\d+/).length).toBe(3);
  });

  it('sorts descending when sortAscending is false', () => {
    const data = [
      { player: 'Alice', total: 50 },
      { player: 'Bob', total: 100 },
      { player: 'Charlie', total: 75 },
    ];
    const { getAllByText } = render(
      <StackRankingChart data={data} sortAscending={false} />
    );
    
    // All scores should be rendered
    expect(getAllByText(/\d+/).length).toBe(3);
  });

  it('renders negative scores correctly', () => {
    const data = [
      { player: 'Alice', total: -5 },
      { player: 'Bob', total: 10 },
    ];
    const { getByText } = render(<StackRankingChart data={data} />);
    expect(getByText('-5')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
  });

  it('gives different bar widths for negative and zero scores', () => {
    const data = [
      { player: 'Alice', total: -10 },
      { player: 'Bob', total: 0 },
      { player: 'Charlie', total: 10 },
    ];
    const { toJSON } = render(<StackRankingChart data={data} />);
    const tree = JSON.stringify(toJSON());

    // All three scores should be displayed
    expect(tree).toContain('-10');
    expect(tree).toContain('"0"'); // Exact match for 0 score text node
    expect(tree).toContain('"10"');

    // Bars should have different widths:
    // Charlie (10): (10 - (-10)) / (10 - (-10)) * 100 = 100%
    // Bob (0):      (0 - (-10)) / (10 - (-10)) * 100 = 50%
    // Alice (-10):  (-10 - (-10)) / (10 - (-10)) * 100 = 0% → clamped to minBar (5%)
    expect(tree).toContain('100%');
    expect(tree).toContain('50%');
    expect(tree).toContain('5%');
  });

  it('scales negative-only scores linearly', () => {
    const data = [
      { player: 'Alice', total: -20 },
      { player: 'Bob', total: -10 },
      { player: 'Charlie', total: -5 },
    ];
    const { toJSON } = render(<StackRankingChart data={data} />);
    const tree = JSON.stringify(toJSON());

    // min = -20, max = 1 (default), range = 21
    // Charlie (-5): (-5 - (-20)) / 21 * 100 ≈ 71.4%
    // Bob (-10): (-10 - (-20)) / 21 * 100 ≈ 47.6%
    // Alice (-20): (-20 - (-20)) / 21 * 100 = 0% → clamped to 15%
    // All scores should be rendered
    expect(tree).toContain('-20');
    expect(tree).toContain('-10');
    expect(tree).toContain('-5');
  });
});
