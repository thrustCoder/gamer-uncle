import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { scoreTrackerStyles as styles } from '../styles/scoreTrackerStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { useScoreTracker } from '../store/ScoreTrackerContext';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';
import PlayerNamesSection from '../components/scoreTracker/PlayerNamesSection';
import GameScoreSection from '../components/scoreTracker/GameScoreSection';
import LeaderboardSection from '../components/scoreTracker/LeaderboardSection';

const MAX_PLAYERS = 20;

export default function ScoreTrackerScreen() {
  const navigation = useNavigation<any>();
  const { gameScore, leaderboard, isLoading } = useScoreTracker();
  
  // Player state - synced with appCache
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 4 }, (_, i) => `P${i + 1}`)
  );

  // Hydrate player data from cache on mount
  useEffect(() => {
    (async () => {
      const [pc, names] = await Promise.all([
        appCache.getPlayerCount(4),
        appCache.getPlayers([]),
      ]);
      setPlayerCount(pc);
      if (names.length > 0) {
        const adjusted = Array.from({ length: pc }, (_, i) => names[i] || `P${i + 1}`);
        setPlayerNames(adjusted);
      } else {
        setPlayerNames(Array.from({ length: pc }, (_, i) => `P${i + 1}`));
      }
    })();
  }, []);

  // Persist player count changes
  useEffect(() => {
    appCache.setPlayerCount(playerCount);
  }, [playerCount]);

  // Persist player names with debounce
  useDebouncedEffect(() => {
    appCache.setPlayers(playerNames);
  }, [playerNames], 400);

  const handleNameChange = (index: number, name: string) => {
    const updated = [...playerNames];
    updated[index] = name;
    setPlayerNames(updated);
  };

  const showPlayerCountPicker = () => {
    Alert.alert(
      'Select Number of Players',
      '',
      [
        ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => ({
          text: `${i + 2}`,
          onPress: () => {
            const newCount = i + 2;
            setPlayerCount(newCount);
            setPlayerNames(
              Array.from({ length: newCount }, (_, j) => playerNames[j] || `P${j + 1}`)
            );
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAddGameScore = () => {
    navigation.navigate('ScoreInput', { mode: 'addRound', isNewGame: true });
  };

  const handleAddLeaderboardScore = () => {
    navigation.navigate('ScoreInput', { mode: 'addLeaderboard' });
  };

  const hasGameScore = gameScore !== null;
  const hasLeaderboard = leaderboard.length > 0;
  const showEmptyState = !hasGameScore && !hasLeaderboard;

  if (isLoading) {
    return (
      <ImageBackground
        source={require('../assets/images/tool_background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.title}>Loading...</Text>
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>Score Tracker</Text>

          {/* Player Names Section */}
          <PlayerNamesSection
            playerCount={playerCount}
            playerNames={playerNames}
            onPlayerCountPress={showPlayerCountPicker}
            onNameChange={handleNameChange}
          />

          {/* Game Score Section */}
          {hasGameScore && (
            <GameScoreSection playerNames={playerNames.slice(0, playerCount)} />
          )}

          {/* Leaderboard Section */}
          {hasLeaderboard && (
            <LeaderboardSection playerNames={playerNames.slice(0, playerCount)} />
          )}

          {/* Empty State - Both buttons when no data */}
          {showEmptyState && (
            <View style={styles.emptyStateContainer}>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddGameScore}
                testID="add-game-score-button"
                {...(Platform.OS === 'web' && { 'data-testid': 'add-game-score-button' })}
              >
                <Text style={styles.emptyStateButtonText}>➕ Add Game Score</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddLeaderboardScore}
                testID="add-leaderboard-button"
                {...(Platform.OS === 'web' && { 'data-testid': 'add-leaderboard-button' })}
              >
                <Text style={styles.emptyStateButtonText}>🏆 Add Leaderboard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Individual Add buttons when one section exists but not the other */}
          {hasGameScore && !hasLeaderboard && (
            <TouchableOpacity
              style={[styles.emptyStateButton, { marginTop: 20, marginHorizontal: 0 }]}
              onPress={handleAddLeaderboardScore}
              testID="add-leaderboard-button"
            >
              <Text style={styles.emptyStateButtonText}>🏆 Add Leaderboard Score</Text>
            </TouchableOpacity>
          )}

          {!hasGameScore && hasLeaderboard && (
            <TouchableOpacity
              style={[styles.emptyStateButton, { marginTop: 20, marginHorizontal: 0 }]}
              onPress={handleAddGameScore}
              testID="add-game-score-button"
            >
              <Text style={styles.emptyStateButtonText}>➕ Add Game Score</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}
