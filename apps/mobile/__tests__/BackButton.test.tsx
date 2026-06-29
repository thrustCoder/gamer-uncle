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

  it('should display the back arrow icon', () => {
    const { getByTestId } = render(<BackButtonWrapper />);
    // The arrow is now an Ionicons "arrow-back" vector icon (mocked to a View
    // with testID `icon-Ionicons`), which self-centres within its glyph box.
    expect(getByTestId('icon-Ionicons')).toBeTruthy();
  });

  it('should have correct testID', () => {
    const { getByTestId } = render(<BackButtonWrapper />);
    const backButton = getByTestId('back-button');
    expect(backButton).toBeTruthy();
  });

  it('should keep the button above page headers for touch handling', () => {
    // The Track Turns page header is absolutely positioned with zIndex 30 and
    // overlaps the button; the button must outrank it so taps aren't swallowed
    // on Android (where pointerEvents pass-through under a higher zIndex is
    // unreliable).
    const z = backButtonStyles.backButton.zIndex as number;
    expect(z).toBeGreaterThan(30);
  });
});

