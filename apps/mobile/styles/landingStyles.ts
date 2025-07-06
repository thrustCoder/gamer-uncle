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
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20, // Add bottom padding to prevent clipping
  },
  topCard: {
    width: '100%',
    height: isLandscape
      ? screenHeight * 0.7 // Larger percentage for landscape devices
      : isTablet 
        ? screenHeight * 0.7 // Smaller percentage for tablets in portrait
        : screenHeight < 740 
          ? screenHeight * 0.55 // Reduced for small phones
          : screenHeight * 0.4, // Standard for regular phones
    marginTop: isLandscape
      ? 30 // Moderate top margin for landscape devices
      : isTablet 
        ? 100 // Larger top margin for tablets (status bar + safe area)
        : screenHeight < 740 
          ? 95 // Increased for small phones like iPhone SE
          : 130, // Standard for regular phones
    marginBottom: 0, // Increased bottom margin
    marginHorizontal: 0,
    marginLeft: 0,
    paddingHorizontal: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: isLandscape ? 'nowrap' : 'wrap', // Single row in landscape
    justifyContent: isLandscape ? 'space-around' : 'space-around',
    marginHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 10, // Increased bottom padding
  },
  iconButtonTurn: {
    width: 166,
    height: 166,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginLeft: 15
  },
  iconButtonTeam: {
    width: 160,
    height: 160,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 5,
    marginRight: 13
  },
  iconButtonDice: {
    width: 128,
    height: 128,
    aspectRatio: 1,
    borderRadius: 15,
    overflow: 'hidden',
    marginLeft: 23,
    marginTop: 22
  },
  iconButtonTimer: {
    width: 160,
    height: 160,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 5,
    marginRight: 2
  },
  iconFull: {
    width: '100%',
    height: '100%',
  },
  versionText: {
    fontSize: 12,
    color: Colors.white,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
});