import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Colors } from '../styles/colors';

export interface RatingBannerProps {
  visible: boolean;
  onRate: () => void;
  onDismiss: () => void;
}

/**
 * A dismissible banner that nudges users to rate the app.
 * Slides down from the top of the chat screen with a 300 ms ease-out animation.
 */
export default function RatingBanner({ visible, onRate, onDismiss }: RatingBannerProps) {
  const slideAnim = useRef(new Animated.Value(-80)).current; // start off-screen
  const isShowing = useRef(false);
  const [renderBanner, setRenderBanner] = useState(false);

  useEffect(() => {
    if (visible && !isShowing.current) {
      isShowing.current = true;
      setRenderBanner(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Announce to screen reader after animation completes
        AccessibilityInfo.announceForAccessibility(
          'Enjoying Gamer Uncle? You can rate the app now.',
        );
      });
    } else if (!visible && isShowing.current) {
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        // Only unmount after slide-out animation completes
        isShowing.current = false;
        setRenderBanner(false);
      });
    }
  }, [visible, slideAnim]);

  if (!renderBanner) return null;

  return (
    <>
      {/* Translucent backdrop — tap anywhere outside the banner to dismiss */}
      <TouchableWithoutFeedback onPress={onDismiss} testID="rating-banner-backdrop">
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
        testID="rating-banner"
        {...(Platform.OS === 'web' && { 'data-testid': 'rating-banner' })}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
      <Text style={styles.starEmoji}>⭐</Text>

      <Text style={styles.promptText}>Enjoying Gamer Uncle? Rate us!</Text>

      <TouchableOpacity
        style={styles.rateButton}
        onPress={onRate}
        testID="rating-banner-rate"
        accessibilityLabel="Rate the app"
        accessibilityRole="button"
      >
        <Text style={styles.rateButtonText}>Rate</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onDismiss}
        testID="rating-banner-dismiss"
        accessibilityLabel="Dismiss rating prompt"
        accessibilityRole="button"
      >
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 232, 201, 0.92)', // themeYellow with slight transparency
    borderLeftWidth: 4,
    borderLeftColor: Colors.themeBrown,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 5,
  },
  starEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  promptText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textDark,
    fontWeight: '500',
  },
  rateButton: {
    backgroundColor: Colors.themeBrown,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 8,
  },
  rateButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 4,
  },
  dismissButton: {
    marginLeft: 8,
    padding: 8,
  },
  dismissText: {
    fontSize: 20,
    color: Colors.grayDark,
    fontWeight: '700',
  },
});
