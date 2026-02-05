import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { useScoreTracker } from '../../store/ScoreTrackerContext';
import StackRankingChart from './StackRankingChart';
import ScoreTable from './ScoreTable';

interface LeaderboardSectionProps {
  playerNames: string[];
}

export default function LeaderboardSection({ playerNames }: LeaderboardSectionProps) {
  const navigation = useNavigation<any>();
  const {
    leaderboard,
    clearLeaderboard,
    getLeaderboardRanking,
    deleteLeaderboardEntry,
  } = useScoreTracker();

  if (leaderboard.length === 0) return null;

  const ranking = getLeaderboardRanking();

  const handleClose = () => {
    Alert.alert(
      'Clear Leaderboard',
      'Are you sure you want to clear the entire leaderboard? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearLeaderboard,
        },
      ]
    );
  };

  const handleAddEntry = () => {
    navigation.navigate('ScoreInput', { mode: 'addLeaderboard' });
  };

  const handleEditEntry = (index: number) => {
    const entry = leaderboard[index];
    if (entry) {
      navigation.navigate('ScoreInput', {
        mode: 'editLeaderboard',
        entryIndex: index,
        game: entry.game,
        existingScores: entry.scores,
      });
    }
  };

  const handleDeleteEntry = (index: number) => {
    const entry = leaderboard[index];
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to remove "${entry?.game.name}" from the leaderboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLeaderboardEntry(index),
        },
      ]
    );
  };

  // Prepare table data with game info
  const tableData = leaderboard.map((entry, index) => ({
    id: `leaderboard-${index}`,
    label: entry.game.name,
    scores: entry.scores,
    entryIndex: index,
    game: entry.game,
  }));

  return (
    <View style={styles.sectionContainer}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={[styles.sectionTitle, { marginLeft: 0 }]}>
            🏆 Leaderboard
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Stack Ranking Chart */}
      {ranking.length > 0 && <StackRankingChart data={ranking} />}

      {/* Score Table */}
      <ScoreTable
        playerNames={playerNames}
        data={tableData}
        firstColumnHeader="Game"
        showGameThumbnails
        onEdit={(_, entryIndex) => handleEditEntry(entryIndex!)}
        onDelete={(_, entryIndex) => handleDeleteEntry(entryIndex!)}
      />

      {/* Add Game Button */}
      <TouchableOpacity style={styles.addRowButton} onPress={handleAddEntry}>
        <Text style={styles.addRowButtonText}>+ Add Game</Text>
      </TouchableOpacity>
    </View>
  );
}
