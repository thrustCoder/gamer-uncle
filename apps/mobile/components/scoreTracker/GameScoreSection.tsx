import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { Colors } from '../../styles/colors';
import { useScoreTracker } from '../../store/ScoreTrackerContext';
import StackRankingChart from './StackRankingChart';
import ScoreTable from './ScoreTable';

interface GameScoreSectionProps {
  playerNames: string[];
}

export default function GameScoreSection({ playerNames }: GameScoreSectionProps) {
  const navigation = useNavigation<any>();
  const { gameScore, clearGameScore, getGameScoreRanking, deleteRound } = useScoreTracker();

  if (!gameScore) return null;

  const ranking = getGameScoreRanking();

  const handleClose = () => {
    Alert.alert(
      'Clear Game Score',
      'Are you sure you want to clear the current game score? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearGameScore,
        },
      ]
    );
  };

  const handleAddRound = () => {
    navigation.navigate('ScoreInput', { mode: 'addRound' });
  };

  const handleEditRound = (roundNumber: number) => {
    const round = gameScore.rounds.find((r) => r.roundNumber === roundNumber);
    if (round) {
      navigation.navigate('ScoreInput', {
        mode: 'editRound',
        roundNumber,
        existingScores: round.scores,
      });
    }
  };

  const handleDeleteRound = (roundNumber: number) => {
    Alert.alert(
      'Delete Round',
      `Are you sure you want to delete Round ${roundNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRound(roundNumber),
        },
      ]
    );
  };

  // Prepare table data
  const tableData = gameScore.rounds.map((round) => ({
    id: `round-${round.roundNumber}`,
    label: `Round ${round.roundNumber}`,
    scores: round.scores,
    roundNumber: round.roundNumber,
  }));

  return (
    <View style={styles.sectionContainer}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          {gameScore.game.thumbnailUrl ? (
            <Image
              source={{ uri: gameScore.game.thumbnailUrl }}
              style={styles.gameThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.gameThumbnailPlaceholder}>
              <MaterialCommunityIcons
                name="dice-multiple"
                size={24}
                color={Colors.grayDark}
              />
            </View>
          )}
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {gameScore.game.name}
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
        firstColumnHeader="Round"
        onEdit={(roundNumber) => roundNumber !== undefined && handleEditRound(roundNumber)}
        onDelete={(roundNumber) => roundNumber !== undefined && handleDeleteRound(roundNumber)}
      />

      {/* Add Round Button */}
      <TouchableOpacity style={styles.addRowButton} onPress={handleAddRound}>
        <Text style={styles.addRowButtonText}>+ Add Round</Text>
      </TouchableOpacity>
    </View>
  );
}
