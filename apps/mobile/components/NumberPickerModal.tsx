import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../styles/colors';

interface NumberPickerModalProps {
  visible: boolean;
  title: string;
  minValue: number;
  maxValue: number;
  selectedValue?: number;
  onSelect: (value: number) => void;
  onClose: () => void;
}

/**
 * Cross-platform numeric picker rendered as a themed modal grid.
 *
 * Used on Android because React Native's `Alert.alert` only supports up to three
 * buttons there — a long list of options (e.g. 2–20 players) silently collapses to
 * three mislaid buttons. iOS keeps using `Alert.alert`, which renders every option,
 * so this modal is only wired up for Android callers.
 */
export default function NumberPickerModal({
  visible,
  title,
  minValue,
  maxValue,
  selectedValue,
  onSelect,
  onClose,
}: NumberPickerModalProps) {
  const count = Math.max(0, maxValue - minValue + 1);
  const values = Array.from({ length: count }, (_, i) => minValue + i);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        testID="number-picker-overlay"
      >
        {/* Stop propagation so taps inside the card don't dismiss the modal */}
        <Pressable style={styles.card} onPress={() => {}} testID="number-picker-modal">
          <Text style={styles.title}>{title}</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {values.map((value) => {
              const isSelected = value === selectedValue;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => {
                    onSelect(value);
                    onClose();
                  }}
                  testID={`number-picker-option-${value}`}
                >
                  <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            testID="number-picker-cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    backgroundColor: Colors.themeYellow,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderWidth: 2,
    borderColor: Colors.themeBrownDark,
    ...Platform.select({
      android: { elevation: 8 },
      default: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.themeGreen,
    textAlign: 'center',
    marginBottom: 14,
  },
  scroll: {
    flexGrow: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  cell: {
    width: 56,
    height: 56,
    margin: 6,
    borderRadius: 12,
    backgroundColor: Colors.themeBrownDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.themeYellow,
  },
  cellSelected: {
    backgroundColor: Colors.themeGreen,
    borderColor: Colors.white,
  },
  cellText: {
    color: Colors.themeYellow,
    fontSize: 20,
    fontWeight: 'bold',
  },
  cellTextSelected: {
    color: Colors.white,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.themeGreen,
    fontSize: 17,
    fontWeight: '700',
  },
});
