import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';

const { width } = Dimensions.get('window');

export const timerStyles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: 'transparent',
    marginTop: 50, // Adjusted for better spacing
  },
  title: {
    fontSize: 70,
    fontWeight: '700', // Reduced from 900 for friendlier look
    color: Colors.teamTitleYellow,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 1, // Reduced from 12 for closer characters
    textShadowColor: Colors.timerTextShadow,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'sans-serif', // Use system font for consistency
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5, // Reduced from 10 to bring presets closer
  },
  progressCircle: {
    width: width * 0.8, // Increased from 0.7 to make center ring larger
    height: width * 0.8, // Increased from 0.7 to make center ring larger
    borderRadius: (width * 0.8) / 2, // Updated radius to match new size
    backgroundColor: Colors.timerBackground, // Dark blue-gray center
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timeText: {
    fontSize: 85,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textAlign: 'center',
    zIndex: 10,
  },
  presetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginVertical: 20, // Reduced from 20 to bring closer to center ring
    paddingHorizontal: 20,
    width: '100%',
  },
  presetButton: {
    backgroundColor: Colors.timerOrangeTransparent, // Orange matching mockup
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flex: 1,
    marginHorizontal: 5,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  presetText: {
    color: Colors.themeYellow,
    fontSize: 25,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginVertical: 10, // Reduced from 20 to bring closer to presets
  },
  mainButton: {
    backgroundColor: Colors.timerRed, // Red-orange matching mockup
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 40,
    minWidth: 140,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  mainButtonText: {
    color: Colors.themeYellow,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: Colors.timerRed,
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 40,
    minWidth: 140,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  resetText: {
    color: Colors.themeYellow,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: Colors.grayDisabled,
    opacity: 0.6,
  },
});