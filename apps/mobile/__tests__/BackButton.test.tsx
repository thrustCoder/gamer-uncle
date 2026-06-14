import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import { backButtonStyles } from '../styles/backButtonStyles';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
}));

const BackButtonWrapper = ({ onPress }: { onPress?: () => void }) => (
  <NavigationContainer>
    <BackButton onPress={onPress} />
  </NavigationContainer>
);

describe('BackButton Component', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(false);
  });

  it('should render correctly', () => {
    const { getByTestId } = render(<BackButtonWrapper />);
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('should call custom onPress when provided', () => {
    const { getByTestId } = render(<BackButtonWrapper onPress={mockOnPress} />);
    
    fireEvent.press(getByTestId('back-button'));
    
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('should pop the stack when canGoBack returns true', () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByTestId } = render(<BackButtonWrapper />);

    fireEvent.press(getByTestId('back-button'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate to Landing when canGoBack returns false', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByTestId } = render(<BackButtonWrapper />);
    
    fireEvent.press(getByTestId('back-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('should display back arrow text', () => {
    const { getByText } = render(<BackButtonWrapper />);
    expect(getByText('←')).toBeTruthy();
  });

  it('should have correct testID', () => {
    const { getByTestId } = render(<BackButtonWrapper />);
    const backButton = getByTestId('back-button');
    expect(backButton).toBeTruthy();
  });

  it('should center the arrow glyph in the circle (no vertical offset)', () => {
    const arrow = backButtonStyles.backArrow as Record<string, unknown>;
    // marginTop pushed the glyph off-center; it must not be present.
    expect(arrow.marginTop).toBeUndefined();
    // Container centering relies on these for a centered glyph.
    expect(arrow.textAlign).toBe('center');
    expect(arrow.textAlignVertical).toBe('center');
    expect(arrow.includeFontPadding).toBe(false);
    // lineHeight should match fontSize so the text box centers within the circle.
    expect(arrow.lineHeight).toBe(arrow.fontSize);
  });
});

