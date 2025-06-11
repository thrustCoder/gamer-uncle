import { StyleSheet } from 'react-native';

export const backButtonStyles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 60, // Moved down to avoid overlapping with title
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly more opaque
    borderRadius: 25, // Increased for larger button
    width: 50, // Increased width
    height: 50, // Increased height
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  backArrow: {
    fontSize: 28, // Increased font size
    color: '#fbe8c9', // Yellow color matching your theme
    fontWeight: '900', // Much thicker/bolder
    lineHeight: 28, // Ensure proper alignment
  },
});