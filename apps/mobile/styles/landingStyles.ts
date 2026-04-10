import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

// Detect if it's an iPad (larger screen width)
const isTablet = Math.min(screenWidth, screenHeight) >= 768;
// Detect landscape orientation (width > height)
const isLandscape = screenWidth > screenHeight;

// Scale multiplier: 3x for tablets, 1x for phones
const scaleMultiplier = isTablet ? 3 : 1;
// Label scale multiplier: 1.5x for tablets (half of icon scale), 1x for phones
const labelScaleMultiplier = isTablet ? 1.5 : 1;

// Calculate center avatar size based on screen
const avatarSize = Math.min(screenWidth, screenHeight) * 0.28;

export const landingStyles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  // Tappable center circle (transparent overlay)
  centerCircleTouchable: {
    position: 'absolute',
    zIndex: 1,
  },
  // Center Uncle Avatar styles
  centerAvatar: {
    position: 'absolute',
    left: screenWidth / 2 - avatarSize / 2,
    top: screenHeight / 2 - avatarSize / 2 - 40, // Slightly above center
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  avatarImage: {
    width: avatarSize * 0.85,
    height: avatarSize * 0.85,
    borderRadius: (avatarSize * 0.85) / 2,
  },
  // Feature button styles (no circular container) - scaled for tablets
  featureButton: {
    position: 'absolute',
    width: 100 * scaleMultiplier,
    height: 100 * scaleMultiplier,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  // Legacy circular icon button (kept for backward compatibility)
  circularIconButton: {
    position: 'absolute',
    width: 60 * scaleMultiplier,
    height: 60 * scaleMultiplier,
    borderRadius: 30 * scaleMultiplier,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 5,
  },
  iconLabel: {
    fontSize: 18 * labelScaleMultiplier,
    color: '#000000',
    textAlign: 'center',
    marginTop: 4 * labelScaleMultiplier,
    fontWeight: '600',
  },
  // Version container at bottom
  versionContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    paddingVertical: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  aiModelText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    paddingVertical: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Legacy styles kept for backward compatibility
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  topCard: {
    width: '100%',
    height: isLandscape
      ? screenHeight * 0.7
      : isTablet 
        ? screenHeight * 0.6
        : screenHeight < 740 
          ? screenHeight * 0.45
          : screenHeight * 0.3,
    marginTop: isLandscape
      ? 30
      : isTablet 
        ? 80
        : screenHeight < 740 
          ? 75
          : 110,
    marginBottom: 0,
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: isLandscape ? 'nowrap' : 'wrap',
    justifyContent: isLandscape ? 'space-around' : 'space-around',
    marginHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    paddingTop: 10,
    gap: 10,
  },
  iconButtonTurn: {
    width: 110,
    height: 110,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  iconButtonTeam: {
    width: 110,
    height: 110,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  iconButtonTimer: {
    width: 110,
    height: 110,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  iconButtonDice: {
    width: 110,
    height: 110,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  iconButtonSetup: {
    width: 110,
    height: 110,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  iconFull: {
    width: '100%',
    height: '100%',
  },
});