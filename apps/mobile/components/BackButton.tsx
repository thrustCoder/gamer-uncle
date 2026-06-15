import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { backButtonStyles as styles } from '../styles/backButtonStyles';
import { Colors } from '../styles/colors';

interface BackButtonProps {
  onPress?: () => void;
}

export default function BackButton({ onPress }: BackButtonProps) {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    // Prefer popping the navigation stack so users return to whichever screen
    // launched this one (e.g. Track Turns -> Timer -> back goes to Track Turns).
    // Fall back to Landing only when there's nothing on the stack.
    if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Landing');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.backButton} 
      onPress={handlePress} 
      testID="back-button"
      {...(Platform.OS === 'web' && { 'data-testid': 'back-button' })}
    >
      {/* Vector icon centers itself within its square glyph box, so the arrow
          sits on the true centre of the circle — unlike a raw "←" text glyph
          whose font metrics push it off-centre. */}
      <Ionicons name="arrow-back" size={24} color={Colors.themeBrownDark} />
    </TouchableOpacity>
  );
}