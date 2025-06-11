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
    marginBottom: 20, // Increased bottom margin
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: isLandscape ? 'nowrap' : 'wrap', // Single row in landscape
    justifyContent: isLandscape ? 'space-around' : 'space-between',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 30, // Increased bottom padding
  },
  iconButton: {
    width: isLandscape ? '22%' : '48%', // Smaller width for single row in landscape
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 10,
  },
  iconFull: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
});