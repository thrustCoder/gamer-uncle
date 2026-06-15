import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const backButtonStyles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 60, // Moved down to avoid overlapping with title
    left: 20,
    // Must outrank screen page headers (e.g. Track Turns header uses zIndex 30)
    // so the button stays the topmost touchable view. A lower zIndex let the
    // absolutely-positioned header — despite pointerEvents="none" — swallow taps
    // on Android, where pointerEvents pass-through is unreliable under a
    // higher-zIndex sibling. On Android, zIndex reorders views for hit-testing,
    // so this alone restores tap responsiveness without inflating the shadow.
    zIndex: 50,
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
});