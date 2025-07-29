import React from 'react';
import { TouchableOpacity, Text, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { backButtonStyles as styles } from '../styles/backButtonStyles';

interface BackButtonProps {
  onPress?: () => void;
}

export default function BackButton({ onPress }: BackButtonProps) {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    if (onPress) {
      onPress();
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
      <Text style={styles.backArrow}>←</Text>
    </TouchableOpacity>
  );
}