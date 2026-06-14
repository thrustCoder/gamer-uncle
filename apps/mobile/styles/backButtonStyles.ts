import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const backButtonStyles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 60, // Moved down to avoid overlapping with title
    left: 20,
    zIndex: 10,
    backgroundColor: Colors.themeYellow, // Slightly more opaque
    borderRadius: 25, // Increased for larger button
    width: 40, // Increased width
    height: 40, // Increased height
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  backArrow: {
    fontSize: 30, // Increased font size
    color: Colors.themeBrownDark, // Yellow color matching your theme
    fontWeight: '900', // Much thicker/bolder
    lineHeight: 30, // Match fontSize so the glyph box centers in the circle
    textAlign: 'center', // Center the arrow horizontally
    textAlignVertical: 'center', // Center the glyph vertically (Android)
    includeFontPadding: false, // Remove Android font padding that skews centering
  },
});