import React from 'react';
import { View, Image, TouchableOpacity, ImageBackground, Text, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { landingStyles as styles } from '../styles/landingStyles';
import Constants from 'expo-constants';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Detect tablet/iPad (screen width >= 768 is typically tablet)
const isTablet = Math.min(screenWidth, screenHeight) >= 768;

// Scale multiplier: 3x for tablets, 1x for phones
const scaleMultiplier = isTablet ? 3 : 1;
// Label scale multiplier: 1.5x for tablets (half of icon scale), 1x for phones
const labelScaleMultiplier = isTablet ? 1.5 : 1;

// Calculate circle layout parameters (scaled for tablets)
const centerX = screenWidth / 2;
const centerY = screenHeight / 2 - 20; // Center of screen
const circleRadius = Math.min(screenWidth, screenHeight) * (isTablet ? 0.38 : 0.45); // Adjust radius for tablets
const iconSize = 100 * scaleMultiplier; // Larger icon touch area, scaled for tablets
const centerCircleSize = Math.min(screenWidth, screenHeight) * (isTablet ? 0.30 : 0.35); // Size of tappable center circle

// Feature configuration for circular layout
const features = [
  { key: 'chat', label: 'Talk to Uncle', screen: 'Chat', icon: 'chatbubbles', iconType: 'ionicon' },
  { key: 'score', label: 'Score\nTracker', screen: 'ScoreTracker', icon: 'scoreboard', iconType: 'material' },
  { key: 'turn', label: 'Turn\nSelector', screen: 'Turn', icon: 'refresh-circle', iconType: 'ionicon' },
  { key: 'search', label: 'Game\nSearch', screen: 'GameSearch', icon: 'search-circle', iconType: 'ionicon' },
  { key: 'team', label: 'Team Randomizer', screen: 'Team', icon: 'people', iconType: 'ionicon' },
  { key: 'timer', label: 'Timer', screen: 'Timer', icon: 'timer', iconType: 'ionicon' },
  { key: 'dice', label: 'Dice\nRoller', screen: 'Dice', icon: 'dice-multiple', iconType: 'material' },
  { key: 'setup', label: 'Game\nSetup', screen: 'GameSetup', icon: 'settings', iconType: 'ionicon' },
];

// Calculate position for each icon in a circle (starting from top, going clockwise)
const getIconPosition = (index: number, total: number, featureKey: string) => {
  // Start from top (-90 degrees) and go clockwise
  const angleInDegrees = -90 + (index * 360) / total;
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  
  // Radial offset to move icons closer/further from center
  let radiusAdjustment = 0;
  if (featureKey === 'turn') {
    radiusAdjustment = -20; // Move Turn Selector closer to center
  } else if (featureKey === 'timer') {
    radiusAdjustment = -15; // Move Timer closer to center
  } else if (featureKey === 'chat') {
    radiusAdjustment = -15; // Move Talk to Uncle closer to center
  } else if (featureKey === 'team') {
    radiusAdjustment = -20; // Move Team Randomizer closer to center
  } else if (featureKey === 'search') {
    radiusAdjustment = -20; // Move Game Search closer to center
  } else if (featureKey === 'dice') {
    radiusAdjustment = -15; // Move Dice Roller closer to center
  } else if (featureKey === 'setup') {
    radiusAdjustment = -10; // Move Game Setup closer to Talk to Uncle
  }
  const adjustedRadius = circleRadius + radiusAdjustment;
  let verticalOffset = 0;
  let horizontalOffset = 0;
  
  // Shift Talk to Uncle slightly higher towards top
  if (featureKey === 'chat') {
    verticalOffset = -5;
  }

  if (featureKey === 'score') {
    horizontalOffset = -5;
  }

  if (featureKey === 'dice') {
    verticalOffset = 5;
    horizontalOffset = 10;
  }
    
  if (featureKey === 'turn') {
    verticalOffset = 0;
  }
  
  if (featureKey === 'timer') {
    verticalOffset = 10;
  }
  
  if (featureKey === 'team') {
    verticalOffset = 5; // Reduced from 15 to move it higher
  }
  
  if (featureKey === 'search') {
    verticalOffset = 20;
    horizontalOffset = 5;
  }
  
  return {
    left: centerX + adjustedRadius * Math.cos(angleInRadians) - iconSize / 2 + horizontalOffset,
    top: centerY + adjustedRadius * Math.sin(angleInRadians) - iconSize / 2 + verticalOffset,
  };
};

const renderIcon = (feature: typeof features[0]) => {
  // Score tracker and Game Setup icons are 20% smaller, Turn Selector/Search are 10% smaller, Team is 10% larger
  // Base sizes scaled by multiplier for tablets (3x for tablets, 1x for phones)
  let baseSize = 60 * scaleMultiplier;
  if (feature.key === 'score' || feature.key === 'setup') {
    baseSize = 48 * scaleMultiplier;
  } else if (feature.key === 'turn') {
    baseSize = 54 * scaleMultiplier;
  } else if (feature.key === 'search') {
    baseSize = 65 * scaleMultiplier; // 20% larger than default 54
  } else if (feature.key === 'team') {
    baseSize = 66 * scaleMultiplier;
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
          onPress={() => {
            trackEvent(AnalyticsEvents.FEATURE_TAPPED, { feature: 'center-circle', target: 'Chat' });
            navigation.navigate('Chat');
          }}
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
              onPress={() => {
                trackEvent(AnalyticsEvents.FEATURE_TAPPED, { feature: feature.key, target: feature.screen });
                feature.screen && navigation.navigate(feature.screen);
              }}
              testID={`${feature.key}-button`}
              {...(Platform.OS === 'web' && { 'data-testid': `${feature.key}-button` })}
            >
              {renderIcon(feature)}
              <Text style={[styles.iconLabel, feature.key === 'team' && { marginTop: -2 * labelScaleMultiplier, width: 130 * labelScaleMultiplier }, feature.key === 'chat' && { width: 130 * labelScaleMultiplier }]}>{feature.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Version info at bottom */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            App Version: {Constants.expoConfig?.version || (Constants.manifest as any)?.version || '3.3.3'}
          </Text>
          <Text style={styles.aiModelText}>AI Model: OpenAI GPT</Text>
        </View>
      </View>
    </ImageBackground>
  );
}