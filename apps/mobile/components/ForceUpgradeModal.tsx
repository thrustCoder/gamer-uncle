import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Colors } from '../styles/colors';

interface ForceUpgradeModalProps {
  visible: boolean;
  message?: string;
  upgradeUrl?: string;
  /** When true the modal cannot be dismissed */
  forceUpgrade: boolean;
  /** Called when user taps "Later" (only available when forceUpgrade is false) */
  onDismiss?: () => void;
}

export default function ForceUpgradeModal({
  visible,
  message,
  upgradeUrl,
  forceUpgrade,
  onDismiss,
}: ForceUpgradeModalProps) {
  const handleUpdate = () => {
    if (upgradeUrl) {
      Linking.openURL(upgradeUrl).catch((err) => {
        console.error('Failed to open upgrade URL:', err);
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      testID="force-upgrade-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.message}>
            {message || 'A new version is available. Please update to continue.'}
          </Text>
          {upgradeUrl ? (
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdate}
              testID="upgrade-button"
              accessibilityRole="button"
              accessibilityLabel="Update app"
            >
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>
          ) : null}
          {!forceUpgrade && (
            <TouchableOpacity
              style={styles.laterButton}
              onPress={onDismiss}
              testID="dismiss-button"
              accessibilityRole="button"
              accessibilityLabel="Dismiss update prompt"
            >
              <Text style={styles.laterButtonText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.themeBrownDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.textDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  updateButton: {
    backgroundColor: Colors.themeGreen,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  laterButtonText: {
    color: Colors.grayDark,
    fontSize: 15,
  },
});
