import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import BackButton from '../components/BackButton';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
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
  });

  it('should navigate to Landing when no onPress provided', () => {
    const { getByTestId } = render(<BackButtonWrapper />);
    
    fireEvent.press(getByTestId('back-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
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
});
