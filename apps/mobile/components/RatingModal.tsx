import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Colors } from '../styles/colors';

export interface RatingModalProps {
  visible: boolean;
  onRate: () => void;
  onDismiss: () => void;
}

/**
 * A centered modal popup that nudges users to rate the app.
 * Used on non-chat feature screens (Score Tracker, Turn Selector, etc.).
 * Fades in with a 250 ms animation.
 */
export default function RatingModal({ visible, onRate, onDismiss }: RatingModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start(() => {
        AccessibilityInfo.announceForAccessibility(
          'Enjoying Gamer Uncle? You can rate the app now.',
        );
      });
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onDismiss}
      testID="rating-modal"
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onDismiss} testID="rating-modal-backdrop">
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          {/* Prevent taps on the card from closing the modal */}
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
              testID="rating-modal-card"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onDismiss}
                testID="rating-modal-dismiss"
                accessibilityLabel="Dismiss rating prompt"
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.emoji}>⭐</Text>
              <Text style={styles.title}>Enjoying Gamer Uncle?</Text>
              <Text style={styles.subtitle}>
                Your rating helps other gamers discover the app!
              </Text>

              <TouchableOpacity
                style={styles.rateButton}
                onPress={onRate}
                testID="rating-modal-rate"
                accessibilityLabel="Rate the app"
                accessibilityRole="button"
              >
                <Text style={styles.rateButtonText}>Rate Us ⭐</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.laterButton}
                onPress={onDismiss}
                testID="rating-modal-later"
                accessibilityLabel="Maybe later"
                accessibilityRole="button"
              >
                <Text style={styles.laterButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.themeYellow,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginHorizontal: 32,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 340,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 14,
    padding: 8,
    zIndex: 1,
  },
  closeText: {
    fontSize: 20,
    color: Colors.grayDark,
    fontWeight: '700',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.grayDark,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  rateButton: {
    backgroundColor: Colors.themeBrown,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  rateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  laterButtonText: {
    color: Colors.grayDark,
    fontSize: 14,
    fontWeight: '500',
  },
});
