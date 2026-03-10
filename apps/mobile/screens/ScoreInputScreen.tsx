import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Image,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { scoreTrackerStyles as styles } from '../styles/scoreTrackerStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { useScoreTracker } from '../store/ScoreTrackerContext';
import { appCache } from '../services/storage/appCache';
import GameSearchModal from '../components/scoreTracker/GameSearchModal';
import RatingModal from '../components/RatingModal';
import {
  incrementEngagement,
  shouldShowFeatureRatingPrompt,
  resetAllEngagementCounters,
  recordDismissal,
  recordRated,
  requestStoreReview,
  resetRatingStateForDev,
  RatingFeatureKeys,
} from '../services/ratingPrompt';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';
import type { GameInfo, ScoreInputMode } from '../types/scoreTracker';

type RouteParams = {
  mode: ScoreInputMode;
  roundNumber?: number;
  entryIndex?: number;
  game?: GameInfo;
  existingScores?: Record<string, number>;
  isNewGame?: boolean;
  lowestScoreWins?: boolean;
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
    lowestScoreWins: paramLowestScoreWins,
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
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(existingGame || null);
  const [showGameSearch, setShowGameSearch] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [lowestScoreWins, setLowestScoreWins] = useState(false);

  // Determine if we need game selection (for leaderboard or new game score)
  const needsGameSelection = mode === 'addLeaderboard' || mode === 'editLeaderboard' || isNewGame;
  const isLeaderboardMode = mode === 'addLeaderboard' || mode === 'editLeaderboard';
  const isEditMode = mode === 'editRound' || mode === 'editLeaderboard';

  // Determine if lowestScoreWins toggle should be locked (disabled)
  // For game rounds: locked after the first round (value comes from session)
  // For leaderboard: always editable
  const isToggleLocked = !isLeaderboardMode && !isNewGame;

  /**
   * Inverts scores using the formula: invertedScore = max + min - score.
   * This function is its own inverse.
   */
  const invertScores = (inputScores: Record<string, number>): Record<string, number> => {
    const values = Object.values(inputScores);
    if (values.length === 0) return inputScores;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const inverted: Record<string, number> = {};
    Object.entries(inputScores).forEach(([player, score]) => {
      inverted[player] = max + min - score;
    });
    return inverted;
  };

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

      // For leaderboard edit with lowestScoreWins, un-invert the stored scores
      const scoresToUse = (mode === 'editLeaderboard' && paramLowestScoreWins && existingScores)
        ? invertScores(existingScores)
        : existingScores;

      // Initialize scores
      const initialScores: Record<string, number> = {};
      playerList.forEach((name) => {
        initialScores[name] = scoresToUse?.[name] ?? 0;
      });
      setScores(initialScores);

      // Initialize lowestScoreWins toggle
      if (isNewGame || mode === 'addLeaderboard') {
        // New entry - default to OFF
        setLowestScoreWins(false);
      } else if (mode === 'editLeaderboard') {
        // Editing leaderboard entry - use the stored flag
        setLowestScoreWins(paramLowestScoreWins ?? false);
      } else {
        // addRound or editRound - use session flag (locked)
        setLowestScoreWins(gameScore?.lowestScoreWins ?? false);
      }

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

  // Clear rating state in dev for easy re-testing
  useEffect(() => {
    resetRatingStateForDev();
  }, []);

  // Rating modal handlers — navigate back after user interacts
  const handleRatingRate = useCallback(async () => {
    setShowRatingModal(false);
    await recordRated();
    await requestStoreReview();
    trackEvent(AnalyticsEvents.RATING_PROMPT_RATED, {
      source: isLeaderboardMode
        ? RatingFeatureKeys.SCORE_TRACKER_LEADERBOARD
        : RatingFeatureKeys.SCORE_TRACKER_GAME_SCORE,
    });
    navigation.goBack();
  }, [isLeaderboardMode, navigation]);

  const handleRatingDismiss = useCallback(async () => {
    setShowRatingModal(false);
    await recordDismissal();
    trackEvent(AnalyticsEvents.RATING_PROMPT_DISMISSED, {
      source: isLeaderboardMode
        ? RatingFeatureKeys.SCORE_TRACKER_LEADERBOARD
        : RatingFeatureKeys.SCORE_TRACKER_GAME_SCORE,
    });
    navigation.goBack();
  }, [isLeaderboardMode, navigation]);

  const handleScoreChange = (playerName: string, value: string) => {
    // Allow empty, minus sign, or valid integer (including negative)
    if (value === '' || value === '-' || /^-?\d+$/.test(value)) {
      setRawInputs((prev) => ({ ...prev, [playerName]: value }));
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        setScores((prev) => ({ ...prev, [playerName]: numValue }));
      }
    }
  };

  const handleInputBlur = (playerName: string) => {
    setRawInputs((prev) => {
      const next = { ...prev };
      delete next[playerName];
      return next;
    });
  };

  const handleIncrement = (playerName: string) => {
    setRawInputs((prev) => { const next = { ...prev }; delete next[playerName]; return next; });
    setScores((prev) => ({
      ...prev,
      [playerName]: (prev[playerName] || 0) + 1,
    }));
  };

  const handleDecrement = (playerName: string) => {
    setRawInputs((prev) => { const next = { ...prev }; delete next[playerName]; return next; });
    setScores((prev) => ({
      ...prev,
      [playerName]: (prev[playerName] || 0) - 1,
    }));
  };

  const handleGameSelect = (game: GameInfo) => {
    setSelectedGame(game);
    setShowGameSearch(false);
  };

  const handleSave = async () => {
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
        addLeaderboardEntry(selectedGame!, scores, lowestScoreWins);
      } else if (mode === 'editLeaderboard' && entryIndex !== undefined) {
        updateLeaderboardEntry(entryIndex, selectedGame!, scores, lowestScoreWins);
      }
    } else {
      // Game score modes
      if (isNewGame && selectedGame) {
        // Start new game and add first round
        startGameScore(selectedGame, lowestScoreWins);
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

    // Track engagement for rating prompt (skip for edit modes)
    if (!isEditMode) {
      const featureKey = isLeaderboardMode
        ? RatingFeatureKeys.SCORE_TRACKER_LEADERBOARD
        : RatingFeatureKeys.SCORE_TRACKER_GAME_SCORE;

      await incrementEngagement(featureKey);
      const shouldShow = await shouldShowFeatureRatingPrompt(featureKey);

      if (shouldShow) {
        await resetAllEngagementCounters();
        setShowRatingModal(true);
        trackEvent(AnalyticsEvents.RATING_PROMPT_SHOWN, { source: featureKey });
        return; // Don't navigate back — modal handlers will do it
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
            style={styles.gameInfoCard}
            onPress={() => setShowGameSearch(true)}
            testID="game-select-button"
          >
            {selectedGame ? (
              <>
                {selectedGame.thumbnailUrl ? (
                  <Image
                    source={{ uri: selectedGame.thumbnailUrl }}
                    style={styles.gameInfoThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.gameInfoThumbnailPlaceholder}>
                    <MaterialCommunityIcons name="dice-multiple" size={32} color={Colors.grayDark} />
                  </View>
                )}
                <View style={styles.gameInfoContent}>
                  <Text style={styles.gameInfoName} numberOfLines={2}>{selectedGame.name}</Text>
                  <Text style={styles.gameInfoTapHint}>Tap to change game</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.gameInfoThumbnailPlaceholder}>
                  <MaterialCommunityIcons name="dice-multiple" size={32} color={Colors.grayDark} />
                </View>
                <View style={styles.gameInfoContent}>
                  <Text style={styles.gameInfoName}>Select a Game</Text>
                  <Text style={styles.gameInfoTapHint}>Tap to search</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Current game display (for adding rounds to existing game) */}
        {!needsGameSelection && gameScore && (
          <View style={styles.gameInfoCard}>
            {gameScore.game.thumbnailUrl ? (
              <Image
                source={{ uri: gameScore.game.thumbnailUrl }}
                style={styles.gameInfoThumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.gameInfoThumbnailPlaceholder}>
                <MaterialCommunityIcons name="dice-multiple" size={32} color={Colors.grayDark} />
              </View>
            )}
            <View style={styles.gameInfoContent}>
              <Text style={styles.gameInfoName} numberOfLines={2}>{gameScore.game.name}</Text>
              <Text style={styles.gameInfoTapHint}>Round {gameScore.rounds.length + 1}</Text>
            </View>
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
                value={rawInputs[playerName] !== undefined ? rawInputs[playerName] : String(scores[playerName] ?? 0)}
                onChangeText={(text) => handleScoreChange(playerName, text)}
                onBlur={() => handleInputBlur(playerName)}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
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

        {/* Lowest Score Wins Toggle */}
        <View style={styles.lowestScoreToggleRow}>
          <Text style={styles.lowestScoreToggleLabel}>Lowest score wins</Text>
          <Switch
            value={lowestScoreWins}
            onValueChange={setLowestScoreWins}
            disabled={isToggleLocked}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={lowestScoreWins ? '#2196F3' : '#f4f3f4'}
            testID="lowest-score-wins-toggle"
          />
        </View>

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

      {/* Rating Prompt Modal */}
      <RatingModal
        visible={showRatingModal}
        onRate={handleRatingRate}
        onDismiss={handleRatingDismiss}
      />
    </ImageBackground>
  );
}
