import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

// Detect if it's an iPad (larger screen width)
const isTablet = screenWidth >= 768;
// Detect landscape orientation (width > height)
const isLandscape = screenWidth > screenHeight;

export const landingStyles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20, // Add bottom padding to prevent clipping
  },
  topCard: {
    width: '100%',
    height: isLandscape
      ? screenHeight * 0.7 // Larger percentage for landscape devices
      : isTablet 
        ? screenHeight * 0.6 // Smaller percentage for tablets in portrait
        : screenHeight < 740 
          ? screenHeight * 0.45 // Reduced for small phones
          : screenHeight * 0.3, // Standard for regular phones
    marginTop: isLandscape
      ? 30 // Moderate top margin for landscape devices
      : isTablet 
        ? 80 // Larger top margin for tablets (status bar + safe area)
        : screenHeight < 740 
          ? 75 // Increased for small phones like iPhone SE
          : 110, // Standard for regular phones
    marginBottom: 0, // Increased bottom margin
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: isLandscape ? 'nowrap' : 'wrap', // Single row in landscape
    justifyContent: isLandscape ? 'space-around' : 'space-around',
    marginHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 10, // Increased bottom padding
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
  versionText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    paddingVertical: 1,
    paddingBottom: 3, // Reduced bottom padding since AI model text will follow
  },
  aiModelText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    paddingVertical: 1,
    paddingTop: 0, // No top padding since it follows version text
    paddingBottom: 30, // Extra bottom padding for safe area
  },
});