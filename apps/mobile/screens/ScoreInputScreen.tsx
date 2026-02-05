import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { scoreTrackerStyles as styles } from '../styles/scoreTrackerStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { useScoreTracker } from '../store/ScoreTrackerContext';
import { appCache } from '../services/storage/appCache';
import GameSearchModal from '../components/scoreTracker/GameSearchModal';
import type { GameInfo, ScoreInputMode } from '../types/scoreTracker';

type RouteParams = {
  mode: ScoreInputMode;
  roundNumber?: number;
  entryIndex?: number;
  game?: GameInfo;
  existingScores?: Record<string, number>;
  isNewGame?: boolean;
};

export default function ScoreInputScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  
  const {
    mode,
    roundNumber,
    entryIndex,
    game: existingGame,
    existingScores,
    isNewGame,
  } = route.params || { mode: 'addRound' };

  const {
    gameScore,
    startGameScore,
    addRound,
    updateRound,
    addLeaderboardEntry,
    updateLeaderboardEntry,
    leaderboard,
  } = useScoreTracker();

  // State
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(existingGame || null);
  const [showGameSearch, setShowGameSearch] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine if we need game selection (for leaderboard or new game score)
  const needsGameSelection = mode === 'addLeaderboard' || mode === 'editLeaderboard' || isNewGame;
  const isLeaderboardMode = mode === 'addLeaderboard' || mode === 'editLeaderboard';
  const isEditMode = mode === 'editRound' || mode === 'editLeaderboard';

  // Get title based on mode
  const getTitle = () => {
    switch (mode) {
      case 'addRound':
        return isNewGame ? 'New Game Score' : 'Add Round';
      case 'editRound':
        return `Edit Round ${roundNumber}`;
      case 'addLeaderboard':
        return 'Add Game to Leaderboard';
      case 'editLeaderboard':
        return 'Edit Leaderboard Entry';
      default:
        return 'Score Input';
    }
  };

  // Load player names from cache
  useEffect(() => {
    (async () => {
      const [pc, names] = await Promise.all([
        appCache.getPlayerCount(4),
        appCache.getPlayers([]),
      ]);
      const playerList = names.length > 0
        ? Array.from({ length: pc }, (_, i) => names[i] || `P${i + 1}`)
        : Array.from({ length: pc }, (_, i) => `P${i + 1}`);
      
      setPlayerNames(playerList);

      // Initialize scores
      const initialScores: Record<string, number> = {};
      playerList.forEach((name) => {
        initialScores[name] = existingScores?.[name] ?? 0;
      });
      setScores(initialScores);
      setIsInitialized(true);
    })();
  }, [existingScores]);

  // For edit leaderboard mode, also load the game
  useEffect(() => {
    if (mode === 'editLeaderboard' && entryIndex !== undefined && leaderboard[entryIndex]) {
      const entry = leaderboard[entryIndex];
      setSelectedGame(entry.game);
    }
  }, [mode, entryIndex, leaderboard]);

  // For new game score, show game search modal immediately
  useEffect(() => {
    if (isNewGame && !selectedGame && isInitialized) {
      setShowGameSearch(true);
    }
  }, [isNewGame, selectedGame, isInitialized]);

  const handleScoreChange = (playerName: string, value: string) => {
    const numValue = value === '' || value === '-' ? 0 : parseInt(value, 10);
    setScores((prev) => ({
      ...prev,
      [playerName]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  const handleIncrement = (playerName: string) => {
    setScores((prev) => ({
      ...prev,
      [playerName]: (prev[playerName] || 0) + 1,
    }));
  };

  const handleDecrement = (playerName: string) => {
    setScores((prev) => ({
      ...prev,
      [playerName]: (prev[playerName] || 0) - 1,
    }));
  };

  const handleGameSelect = (game: GameInfo) => {
    setSelectedGame(game);
    setShowGameSearch(false);
  };

  const handleSave = () => {
    // Validate
    if (needsGameSelection && !selectedGame) {
      Alert.alert('Missing Game', 'Please select a game first.');
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    if (isLeaderboardMode) {
      // Leaderboard modes
      if (mode === 'addLeaderboard') {
        addLeaderboardEntry(selectedGame!, scores);
      } else if (mode === 'editLeaderboard' && entryIndex !== undefined) {
        updateLeaderboardEntry(entryIndex, selectedGame!, scores);
      }
    } else {
      // Game score modes
      if (isNewGame && selectedGame) {
        // Start new game and add first round
        startGameScore(selectedGame);
        // Need to add round after starting - use setTimeout to ensure state updates
        setTimeout(() => {
          addRound(scores);
        }, 0);
      } else if (mode === 'addRound') {
        addRound(scores);
      } else if (mode === 'editRound' && roundNumber !== undefined) {
        updateRound(roundNumber, scores);
      }
    }

    navigation.goBack();
  };

  const canSave = needsGameSelection ? selectedGame !== null : true;

  if (!isInitialized) {
    return (
      <ImageBackground
        source={require('../assets/images/tool_background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.inputScreenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.inputTitle}>Loading...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../assets/images/tool_background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <BackButton />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20, paddingTop: 60 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.inputTitle}>{getTitle()}</Text>

        {/* Game Selection (for leaderboard or new game) */}
        {needsGameSelection && (
          <TouchableOpacity
            style={[styles.scoreInputRow, { marginBottom: 20 }]}
            onPress={() => setShowGameSearch(true)}
            testID="game-select-button"
          >
            <Text style={styles.scoreInputLabel}>
              {selectedGame ? selectedGame.name : 'Select Game...'}
            </Text>
            <Text style={{ fontSize: 20 }}>🎲</Text>
          </TouchableOpacity>
        )}

        {/* Current game display (for adding rounds to existing game) */}
        {!needsGameSelection && gameScore && (
          <View style={[styles.scoreInputRow, { marginBottom: 20, opacity: 0.8 }]}>
            <Text style={styles.scoreInputLabel}>
              {gameScore.game.name} - Round {gameScore.rounds.length + 1}
            </Text>
          </View>
        )}

        {/* Player Score Inputs */}
        {playerNames.map((playerName, index) => (
          <View key={index} style={styles.scoreInputRow}>
            <Text style={styles.scoreInputLabel} numberOfLines={1}>
              {playerName}
            </Text>
            <View style={styles.scoreInputControls}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleDecrement(playerName)}
                testID={`decrement-${index}`}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.scoreInput}
                value={String(scores[playerName] ?? 0)}
                onChangeText={(text) => handleScoreChange(playerName, text)}
                keyboardType="numeric"
                selectTextOnFocus
                testID={`score-input-${index}`}
                {...(Platform.OS === 'web' && { 'data-testid': `score-input-${index}` })}
              />
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleIncrement(playerName)}
                testID={`increment-${index}`}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          testID="save-button"
          {...(Platform.OS === 'web' && { 'data-testid': 'save-button' })}
        >
          <Text style={styles.saveButtonText}>
            {isEditMode ? 'Update' : 'Save'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Game Search Modal */}
      <GameSearchModal
        visible={showGameSearch}
        onClose={() => {
          setShowGameSearch(false);
          // If closing without selecting and it's a new game, go back
          if (isNewGame && !selectedGame) {
            navigation.goBack();
          }
        }}
        onSelectGame={handleGameSelect}
      />
    </ImageBackground>
  );
}
