import { StyleSheet, Dimensions } from 'react-native';

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
  },
  title: {
    fontSize: 70,
    fontWeight: '700', // Reduced from 900 for friendlier look
    color: '#f4e4bc',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 1, // Reduced from 12 for closer characters
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
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
    backgroundColor: '#2C3E50', // Dark blue-gray center
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timeText: {
    fontSize: 85,
    fontWeight: 'bold',
    color: '#fbe8c9',
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
    backgroundColor: 'rgba(230, 126, 34, 0.8)', // Orange matching mockup
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  presetText: {
    color: '#fbe8c9',
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
    backgroundColor: '#C0392B', // Red-orange matching mockup
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 40,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  mainButtonText: {
    color: '#fbe8c9',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#C0392B',
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 40,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  resetText: {
    color: '#fbe8c9',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#6B7280',
    opacity: 0.6,
  },
});