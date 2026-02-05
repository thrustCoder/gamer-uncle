import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { Colors } from '../../styles/colors';

interface PlayerNamesSectionProps {
  playerCount: number;
  playerNames: string[];
  onPlayerCountPress: () => void;
  onNameChange: (index: number, name: string) => void;
}

export default function PlayerNamesSection({
  playerCount,
  playerNames,
  onPlayerCountPress,
  onNameChange,
}: PlayerNamesSectionProps) {
  // Determine input width based on player count
  const getInputStyle = () => {
    if (playerCount <= 4) {
      return [styles.playerNameInput, styles.playerNameInputWide];
    }
    return [styles.playerNameInput, styles.playerNameInputNarrow];
  };

  return (
    <View style={styles.playerSection}>
      {/* Header with player count picker */}
      <View style={styles.playerSectionHeader}>
        <Text style={styles.sectionLabel}>Number of players</Text>
        <TouchableOpacity
          style={styles.playerCountButton}
          onPress={onPlayerCountPress}
          testID="player-count-button"
        >
          <Text style={styles.playerCountText}>{playerCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Player name inputs - only show for 6 or fewer players */}
      {playerCount <= 6 && (
        <View style={styles.playerNamesGrid}>
          {Array.from({ length: playerCount }).map((_, index) => (
            <TextInput
              key={index}
              style={getInputStyle()}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor={Colors.grayDark}
              value={playerNames[index] ?? ''}
              onChangeText={(text) => onNameChange(index, text)}
              testID={`player-name-input-${index}`}
            />
          ))}
        </View>
      )}

      {/* Message for many players */}
      {playerCount > 6 && (
        <Text style={[styles.sectionLabel, { fontSize: 14, opacity: 0.7, textAlign: 'center' }]}>
          {playerCount} players configured
        </Text>
      )}
    </View>
  );
}
