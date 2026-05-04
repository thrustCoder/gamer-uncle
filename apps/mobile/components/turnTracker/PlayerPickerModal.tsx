import React from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';

import { turnTrackerStyles as styles } from '../../styles/turnTrackerStyles';

interface PlayerPickerModalProps {
  visible: boolean;
  /** All player names from the active source (group or appCache). */
  playerNames: string[];
  /** Player indices already seated elsewhere — these rows are disabled (except `currentSelection`). */
  seatedPlayerIndices: number[];
  /** Currently seated player at the seat being edited, or null for empty seats. */
  currentSelection: number | null;
  /** 1-based seat number being edited (for header copy). */
  seatNumber: number;
  /** Called when the user picks a player. */
  onPick: (playerIndex: number) => void;
  /** Called when the user clears the seat (only available when editing a filled seat). */
  onClear?: () => void;
  /** Called when the modal is dismissed without a selection. */
  onClose: () => void;
}

const PlayerPickerModal: React.FC<PlayerPickerModalProps> = ({
  visible,
  playerNames,
  seatedPlayerIndices,
  currentSelection,
  seatNumber,
  onPick,
  onClear,
  onClose,
}) => {
  const seatedSet = new Set(seatedPlayerIndices);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
        testID="player-picker-backdrop"
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
          <Text style={styles.modalHeader}>{`Choose player for Seat ${seatNumber}`}</Text>

          <FlatList
            data={playerNames.map((name, index) => ({ index, name }))}
            keyExtractor={(item) => `pick-${item.index}`}
            renderItem={({ item }) => {
              const isSelected = item.index === currentSelection;
              const isDisabled = seatedSet.has(item.index) && !isSelected;
              return (
                <TouchableOpacity
                  style={[
                    styles.modalRow,
                    isDisabled && styles.modalRowDisabled,
                    isSelected && styles.modalRowSelected,
                  ]}
                  disabled={isDisabled}
                  onPress={() => onPick(item.index)}
                  testID={`player-picker-row-${item.index}`}
                >
                  <Text style={styles.modalRowText}>
                    {item.name || `P${item.index + 1}`}
                  </Text>
                  {isDisabled && (
                    <Text style={styles.modalRowSubtext}>Already seated</Text>
                  )}
                  {isSelected && (
                    <Text style={styles.modalRowSubtext}>Currently in this seat</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} testID="player-picker-cancel">
              <Text style={styles.modalActionText}>Cancel</Text>
            </TouchableOpacity>
            {onClear && currentSelection != null && (
              <TouchableOpacity onPress={onClear} testID="player-picker-clear">
                <Text style={[styles.modalActionText, styles.modalActionDanger]}>
                  Clear seat
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default PlayerPickerModal;
