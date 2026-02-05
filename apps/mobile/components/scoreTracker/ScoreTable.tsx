import React, { useMemo } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { Colors } from '../../styles/colors';
import ScoreTableRow from './ScoreTableRow';
import { generateUniqueInitials } from '../../utils/initialsUtils';
import type { GameInfo } from '../../types/scoreTracker';

interface TableDataItem {
  id: string;
  label: string;
  scores: Record<string, number>;
  roundNumber?: number;
  entryIndex?: number;
  game?: GameInfo;
}

interface ScoreTableProps {
  playerNames: string[];
  data: TableDataItem[];
  firstColumnHeader: string;
  showGameThumbnails?: boolean;
  onEdit: (roundNumber?: number, entryIndex?: number) => void;
  onDelete: (roundNumber?: number, entryIndex?: number) => void;
}

export default function ScoreTable({
  playerNames,
  data,
  firstColumnHeader,
  showGameThumbnails = false,
  onEdit,
  onDelete,
}: ScoreTableProps) {
  // Generate initials for player names
  const initials = useMemo(
    () => generateUniqueInitials(playerNames),
    [playerNames]
  );

  // Calculate column width based on number of players
  const playerColumnWidth = Math.max(50, (100 - 25) / playerNames.length);

  if (data.length === 0) {
    return (
      <View style={styles.tableContainer}>
        <Text style={[styles.sectionLabel, { padding: 20, textAlign: 'center', opacity: 0.6 }]}>
          No data yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tableContainer}>
      {/* Header Row */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellFirst]}>
          {firstColumnHeader}
        </Text>
        {playerNames.map((name, index) => (
          <Text
            key={index}
            style={[styles.tableHeaderCell, { flex: 1 }]}
            numberOfLines={1}
          >
            {initials[name]}
          </Text>
        ))}
      </View>

      {/* Data Rows */}
      <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
        {data.map((item) => (
          <ScoreTableRow
            key={item.id}
            label={item.label}
            scores={item.scores}
            playerNames={playerNames}
            game={showGameThumbnails ? item.game : undefined}
            onEdit={() => onEdit(item.roundNumber, item.entryIndex)}
            onDelete={() => onDelete(item.roundNumber, item.entryIndex)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
