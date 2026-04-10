import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { Colors } from '../../styles/colors';
import type { GameInfo } from '../../types/scoreTracker';

interface ScoreTableRowProps {
  label: string;
  scores: Record<string, number>;
  playerNames: string[];
  playerColumnWidth?: number;
  firstColumnWidth?: number;
  game?: GameInfo;
  /** When true, shows a swap icon indicating scores were inverted */
  lowestScoreWins?: boolean;
  onEdit: () => void;
}

export default function ScoreTableRow({
  label,
  scores,
  playerNames,
  playerColumnWidth = 48,
  firstColumnWidth = 80,
  game,
  lowestScoreWins,
  onEdit,
}: ScoreTableRowProps) {
  return (
    <View style={styles.tableRow}>
      {/* First column - label or game */}
      {game ? (
        <View style={[styles.gameCell, { width: firstColumnWidth }]}>
          {game.thumbnailUrl ? (
            <Image
              source={{ uri: game.thumbnailUrl }}
              style={styles.gameCellThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.gameCellThumbnail, { backgroundColor: Colors.grayPlaceholder, alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialCommunityIcons name="dice-multiple" size={16} color={Colors.grayDark} />
            </View>
          )}
          <Text style={styles.gameCellName} numberOfLines={1}>
            {label}
          </Text>
          {lowestScoreWins && (
            <MaterialCommunityIcons
              name="swap-vertical"
              size={14}
              color={Colors.grayLight}
              style={{ marginLeft: 2 }}
            />
          )}
        </View>
      ) : (
        <Text style={[styles.tableCell, styles.tableCellFirst, { width: firstColumnWidth }]}>{label}</Text>
      )}

      {/* Score columns */}
      {playerNames.map((playerName, index) => (
        <Text key={index} style={[styles.tableCell, { width: playerColumnWidth, textAlign: 'center' }]}>
          {scores[playerName] ?? 0}
        </Text>
      ))}

      {/* Edit pencil icon */}
      <TouchableOpacity onPress={onEdit} style={styles.rowEditButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.grayLight} />
      </TouchableOpacity>
    </View>
  );
}
