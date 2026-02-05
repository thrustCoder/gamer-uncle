import { generateUniqueInitials } from '../utils/initialsUtils';

describe('generateUniqueInitials', () => {
  it('returns Title Case initials for names starting with same letter', () => {
    const result = generateUniqueInitials(['P1', 'P2', 'P3']);
    // All start with P, so need 2 chars to differentiate
    expect(result['P1']).toBe('P1');
    expect(result['P2']).toBe('P2');
    expect(result['P3']).toBe('P3');
  });

  it('returns Title Case for multi-letter initials when needed for uniqueness', () => {
    const result = generateUniqueInitials(['Alice', 'Alex', 'Bob']);
    // Alice and Alex both start with 'A', so need 3 chars (Ali vs Ale)
    expect(result['Alice']).toBe('Ali');
    expect(result['Alex']).toBe('Ale');
    expect(result['Bob']).toBe('Bob');
  });

  it('returns Title Case for 3-letter initials with similar names', () => {
    const result = generateUniqueInitials(['Alice', 'Alicia', 'Bob']);
    // Alice and Alicia both start with 'Ali', need numeric suffix for duplicate
    expect(result['Alice']).toBe('Ali');
    expect(result['Alicia']).toBe('Al2');
    expect(result['Bob']).toBe('Bob');
  });

  it('keeps single character initials uppercase', () => {
    const result = generateUniqueInitials(['A', 'B', 'C']);
    expect(result['A']).toBe('A');
    expect(result['B']).toBe('B');
    expect(result['C']).toBe('C');
  });

  it('handles mixed case input consistently with Title Case output', () => {
    const result = generateUniqueInitials(['ALICE', 'alex', 'BOB']);
    // ALICE and alex both start with A, need 3 chars
    expect(result['ALICE']).toBe('Ali');
    expect(result['alex']).toBe('Ale');
    expect(result['BOB']).toBe('Bob');
  });

  it('handles empty names with question mark', () => {
    const result = generateUniqueInitials(['Alice', '', 'Bob']);
    expect(result['Alice']).toBe('A');
    expect(result['']).toBe('?');
    expect(result['Bob']).toBe('B');
  });

  it('handles duplicate names - same key gets overwritten with suffixed value', () => {
    const result = generateUniqueInitials(['Alice', 'Alice']);
    // When duplicate names exist, the second one overwrites with Al2 suffix
    expect(result['Alice']).toBe('Al2');
  });

  it('handles whitespace in names', () => {
    const result = generateUniqueInitials(['  Alice  ', 'Bob']);
    expect(result['  Alice  ']).toBe('A');
    expect(result['Bob']).toBe('B');
  });

  it('returns uppercase for truly single letter when unique', () => {
    const result = generateUniqueInitials(['X', 'Y', 'Z']);
    expect(result['X']).toBe('X');
    expect(result['Y']).toBe('Y');
    expect(result['Z']).toBe('Z');
  });
});
