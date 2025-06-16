import { StyleSheet, Dimensions } from 'react-native';

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
        ? screenHeight * 0.45 // Smaller percentage for tablets in portrait
        : screenHeight < 740 
          ? screenHeight * 0.45 // Reduced for small phones
          : screenHeight * 0.3, // Standard for regular phones
    marginTop: isLandscape
      ? 20 // Moderate top margin for landscape devices
      : isTablet 
        ? 20 // Larger top margin for tablets (status bar + safe area)
        : screenHeight < 740 
          ? 15 // Increased for small phones like iPhone SE
          : 50, // Standard for regular phones
    marginBottom: 10, // Increased bottom margin
    marginHorizontal: 0,
    marginLeft: 10,
    paddingHorizontal: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: isLandscape ? 'nowrap' : 'wrap', // Single row in landscape
    justifyContent: isLandscape ? 'space-around' : 'space-between',
    marginHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10, // Increased bottom padding
  },
  iconButtonTurn: {
    width: 167,
    height: 167,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginLeft: 5
  },
  iconButtonTeam: {
    width: 160,
    height: 160,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 5,
    marginRight: 5
  },
  iconButtonDice: {
    width: 128,
    height: 128,
    aspectRatio: 1,
    borderRadius: 15,
    overflow: 'hidden',
    marginLeft: 26,
    marginTop: 22
  },
  iconButtonTimer: {
    width: 160,
    height: 160,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 5,
    marginRight: 5
  },
  iconFull: {
    width: '100%',
    height: '100%',
    // borderRadius: 24,
  },
});