import React from 'react';
import { View, Image, TouchableOpacity, ImageBackground, Text, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { landingStyles as styles } from '../styles/landingStyles';
import Constants from 'expo-constants';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Calculate circle layout parameters
const centerX = screenWidth / 2;
const centerY = screenHeight / 2 - 20; // Center of screen
const circleRadius = Math.min(screenWidth, screenHeight) * 0.45; // Even larger radius for more spread
const iconSize = 100; // Larger icon touch area
const centerCircleSize = Math.min(screenWidth, screenHeight) * 0.35; // Size of tappable center circle

// Feature configuration for circular layout
const features = [
  { key: 'chat', label: 'Talk to Uncle', screen: 'Chat', icon: 'chatbubbles', iconType: 'ionicon' },
  { key: 'score', label: 'Score\nTracker', screen: null, icon: 'scoreboard', iconType: 'material' },
  { key: 'turn', label: 'Turn\nSelector', screen: 'Turn', icon: 'refresh-circle', iconType: 'ionicon' },
  { key: 'search', label: 'Game\nSearch', screen: null, icon: 'search', iconType: 'ionicon' },
  { key: 'team', label: 'Team\nRandomizer', screen: 'Team', icon: 'people', iconType: 'ionicon' },
  { key: 'timer', label: 'Timer', screen: 'Timer', icon: 'timer', iconType: 'ionicon' },
  { key: 'dice', label: 'Dice\nRoller', screen: 'Dice', icon: 'dice-multiple', iconType: 'material' },
  { key: 'setup', label: 'Game\nSetup', screen: 'GameSetup', icon: 'settings', iconType: 'ionicon' },
];

// Calculate position for each icon in a circle (starting from top, going clockwise)
const getIconPosition = (index: number, total: number, featureKey: string) => {
  // Start from top (-90 degrees) and go clockwise
  const angleInDegrees = -90 + (index * 360) / total;
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  
  // Radial offset for Timer and Turn Selector to move them inward, Timer moves outward
  let radiusAdjustment = 0;
  if (featureKey === 'turn') {
    radiusAdjustment = -10;
  } else if (featureKey === 'timer') {
    radiusAdjustment = 5; // Move Timer outward
  } else if (featureKey === 'chat') {
    radiusAdjustment = -15; // Move Talk to Uncle closer to center
  }
  const adjustedRadius = circleRadius + radiusAdjustment;
  
  // Add vertical offset for bottom icons (indices 3 and 4) to accommodate thicker ring base
  let verticalOffset = (index === 3 || index === 4) ? 25 : 0;
  
  // Shift Talk to Uncle slightly higher towards top
  if (featureKey === 'chat') {
    verticalOffset = -15;
  }
  
  // Timer and Turn Selector move slightly downward
  if (featureKey === 'timer' || featureKey === 'turn') {
    verticalOffset = 10;
  }
  
  // Horizontal offset for Dice Roller to move it right
  let horizontalOffset = 0;
  if (featureKey === 'dice') {
    horizontalOffset = 10;
  }
  
  return {
    left: centerX + adjustedRadius * Math.cos(angleInRadians) - iconSize / 2 + horizontalOffset,
    top: centerY + adjustedRadius * Math.sin(angleInRadians) - iconSize / 2 + verticalOffset,
  };
};

const renderIcon = (feature: typeof features[0]) => {
  // Score tracker and Game Setup icons are 20% smaller, Turn Selector/Search are 10% smaller, Team is 10% larger
  let baseSize = 60;
  if (feature.key === 'score' || feature.key === 'setup') {
    baseSize = 48;
  } else if (feature.key === 'turn' || feature.key === 'search') {
    baseSize = 54;
  } else if (feature.key === 'team') {
    baseSize = 66;
  }
  const iconProps = { size: baseSize, color: '#000000' };
  
  switch (feature.iconType) {
    case 'material':
      return <MaterialCommunityIcons name={feature.icon as any} {...iconProps} />;
    case 'fontawesome':
      return <FontAwesome5 name={feature.icon as any} {...iconProps} />;
    default:
      return <Ionicons name={feature.icon as any} {...iconProps} />;
  }
};

export default function LandingScreen() {
  const navigation = useNavigation<any>();

  return (
    <ImageBackground
      source={require('../assets/images/v3.0/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Tappable center circle area */}
        <TouchableOpacity
          style={[
            styles.centerCircleTouchable,
            {
              left: centerX - centerCircleSize / 2,
              top: centerY - centerCircleSize / 2,
              width: centerCircleSize,
              height: centerCircleSize,
              borderRadius: centerCircleSize / 2,
            },
          ]}
          onPress={() => navigation.navigate('Chat')}
          testID="center-circle"
          {...(Platform.OS === 'web' && { 'data-testid': 'center-circle' })}
        />

        {/* Circular Feature Icons */}
        {features.map((feature, index) => {
          const position = getIconPosition(index, features.length, feature.key);
          return (
            <TouchableOpacity
              key={feature.key}
              style={[
                styles.featureButton,
                {
                  left: position.left,
                  top: position.top,
                },
              ]}
              onPress={() => feature.screen && navigation.navigate(feature.screen)}
              testID={`${feature.key}-button`}
              {...(Platform.OS === 'web' && { 'data-testid': `${feature.key}-button` })}
            >
              {renderIcon(feature)}
              <Text style={styles.iconLabel}>{feature.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Version info at bottom */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            App Version: {Constants.expoConfig?.version || (Constants.manifest as any)?.version || '3.0.0'}
          </Text>
          <Text style={styles.aiModelText}>AI Model: OpenAI GPT</Text>
        </View>
      </View>
    </ImageBackground>
  );
}