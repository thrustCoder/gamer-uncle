import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      {/*
       * Centering wrapper. The backdrop sits *behind* the card as an
       * absolutely-positioned Pressable, so taps inside the card land on the
       * card View (which does not claim the touch responder) and the inner
       * FlatList can freely grab the pan responder to scroll — even when
       * the swipe starts on a non-touchable row like an already-seated
       * player. Taps outside the card hit the backdrop and dismiss.
       */}
      <View style={styles.modalRoot}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.modalBackdropDim]}
          onPress={onClose}
          testID="player-picker-backdrop"
        />
        <View style={styles.modalCard}>
          <Text style={styles.modalHeader}>{`Choose player for Seat ${seatNumber}`}</Text>

          <FlatList
            data={playerNames.map((name, index) => ({ index, name }))}
            keyExtractor={(item) => `pick-${item.index}`}
            style={styles.modalList}
            // Allow vertical scrolling once the list overflows the card's
            // bounded height. Without this the FlatList would render all
            // rows at full intrinsic height and get clipped by the card's
            // `overflow: hidden`, leaving later players unreachable.
            showsVerticalScrollIndicator
            bounces
            // Player rosters are bounded (≤20) and rows are cheap, so render
            // them all up-front. This avoids virtualization hiccups while the
            // user scrolls quickly to assign seats.
            initialNumToRender={playerNames.length}
            windowSize={Math.max(playerNames.length, 1)}
            renderItem={({ item }) => {
              const isSelected = item.index === currentSelection;
              const isDisabled = seatedSet.has(item.index) && !isSelected;
              // Render disabled rows as a plain View so they don't capture
              // the touch responder. A `disabled` TouchableOpacity still
              // claims the gesture, which would prevent the FlatList from
              // scrolling whenever the user's finger lands on an
              // already-seated row.
              if (isDisabled) {
                return (
                  <View
                    style={[styles.modalRow, styles.modalRowDisabled]}
                    testID={`player-picker-row-${item.index}`}
                  >
                    <Text style={styles.modalRowText}>
                      {item.name || `P${item.index + 1}`}
                    </Text>
                    <Text style={styles.modalRowSubtext}>Already seated</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  style={[
                    styles.modalRow,
                    isSelected && styles.modalRowSelected,
                  ]}
                  onPress={() => onPick(item.index)}
                  testID={`player-picker-row-${item.index}`}
                >
                  <Text style={styles.modalRowText}>
                    {item.name || `P${item.index + 1}`}
                  </Text>
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
        </View>
      </View>
    </Modal>
  );
};

export default PlayerPickerModal;
