import React, { useMemo } from 'react';
import { View, Text, Image, ScrollView, useWindowDimensions } from 'react-native';
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
  lowestScoreWins?: boolean;
}

interface ScoreTableProps {
  playerNames: string[];
  data: TableDataItem[];
  firstColumnHeader: string;
  firstColumnWidth?: number;
  showGameThumbnails?: boolean;
  onEdit: (roundNumber?: number, entryIndex?: number) => void;
  onDelete: (roundNumber?: number, entryIndex?: number) => void;
}

const PLAYER_COL_WIDTH = 48;
const DEFAULT_FIRST_COL_WIDTH = 80;

export default function ScoreTable({
  playerNames,
  data,
  firstColumnHeader,
  firstColumnWidth = DEFAULT_FIRST_COL_WIDTH,
  showGameThumbnails = false,
  onEdit,
  onDelete,
}: ScoreTableProps) {
  // Generate initials for player names
  const initials = useMemo(
    () => generateUniqueInitials(playerNames),
    [playerNames]
  );

  const { width: screenWidth } = useWindowDimensions();
  // Estimate available width inside the table container (screen minus outer padding)
  const availableWidth = screenWidth - 48; // ~24px padding on each side
  const fixedTotalWidth = firstColumnWidth + playerNames.length * PLAYER_COL_WIDTH + 16;
  const needsScroll = fixedTotalWidth > availableWidth;
  // When content fits, distribute remaining space equally to player columns
  const playerColWidth = needsScroll
    ? PLAYER_COL_WIDTH
    : Math.floor((availableWidth - firstColumnWidth - 16) / playerNames.length);

  if (data.length === 0) {
    return (
      <View style={styles.tableContainer}>
        <Text style={[styles.sectionLabel, { padding: 20, textAlign: 'center', opacity: 0.6 }]}>
          No data yet
        </Text>
      </View>
    );
  }

  const tableContent = (
    <View style={needsScroll ? { minWidth: fixedTotalWidth } : undefined}>
      {/* Header Row */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellFirst, { width: firstColumnWidth }]}>
          {firstColumnHeader}
        </Text>
        {playerNames.map((name, index) => (
          <Text
            key={index}
            style={[styles.tableHeaderCell, { width: playerColWidth }]}
            numberOfLines={1}
          >
            {initials[name]}
          </Text>
        ))}
      </View>

      {/* Data Rows */}
      {data.map((item) => (
        <ScoreTableRow
          key={item.id}
          label={item.label}
          scores={item.scores}
          playerNames={playerNames}
          playerColumnWidth={playerColWidth}
          firstColumnWidth={firstColumnWidth}
          game={showGameThumbnails ? item.game : undefined}
          lowestScoreWins={item.lowestScoreWins}
          onEdit={() => onEdit(item.roundNumber, item.entryIndex)}
          onDelete={() => onDelete(item.roundNumber, item.entryIndex)}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.tableContainer}>
      {needsScroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tableContent}
        </ScrollView>
      ) : (
        tableContent
      )}
    </View>
  );
}
