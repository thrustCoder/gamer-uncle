import { StyleSheet } from 'react-native';

export const backButtonStyles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 10, // Moved down to avoid overlapping with title
    left: 10,
    zIndex: 10,
    backgroundColor: '#D68F20', // Slightly more opaque
    borderRadius: 25, // Increased for larger button
    width: 30, // Increased width
    height: 30, // Increased height
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  backArrow: {
    fontSize: 30, // Increased font size
    color: '#fbe8c9', // Yellow color matching your theme
    fontWeight: '900', // Much thicker/bolder
    lineHeight: 30, // Ensure proper alignment
    marginTop: -6, // Adjusted to center vertically
    textAlign: 'center', // Center the arrow
  },
});