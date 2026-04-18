import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { scoreTrackerStyles as styles } from '../styles/scoreTrackerStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { useScoreTracker } from '../store/ScoreTrackerContext';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';
import PlayerNamesSection from '../components/scoreTracker/PlayerNamesSection';
import GameScoreSection from '../components/scoreTracker/GameScoreSection';
import LeaderboardSection from '../components/scoreTracker/LeaderboardSection';
import EnableGroupsToggle from '../components/EnableGroupsToggle';
import GroupPicker from '../components/GroupPicker';
import { usePlayerGroups } from '../store/PlayerGroupsContext';
import type { GameScoreSession, LeaderboardEntry } from '../types/scoreTracker';

const MAX_PLAYERS = 20;

/**
 * Extracts the ordered list of player names from existing score data.
 * Uses the first round's score keys (game score) or first entry's score keys (leaderboard).
 * Object.keys preserves insertion order, which matches the player list order when scores were entered.
 */
function extractPlayerNamesFromScores(
  scoreData: GameScoreSession | null,
  leaderboardData: LeaderboardEntry[],
): string[] {
  if (scoreData?.rounds?.[0]?.scores) {
    return Object.keys(scoreData.rounds[0].scores);
  }
  if (leaderboardData.length > 0 && leaderboardData[0].scores) {
    return Object.keys(leaderboardData[0].scores);
  }
  return [];
}

export default function ScoreTrackerScreen() {
  const navigation = useNavigation<any>();
  const { gameScore, leaderboard, isLoading, renamePlayer, clearGameScore, clearLeaderboard, loadGroupData } = useScoreTracker();
  const { state: groupsState, activeGroup, updateActiveGroupData } = usePlayerGroups();
  
  // Player state - synced with appCache
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 4 }, (_, i) => `P${i + 1}`)
  );
  
  // Track previous names for rename detection
  const prevPlayerNamesRef = useRef<string[]>([]);
  // Track current (in-flight) names so onBlur always reads the latest value
  const currentPlayerNamesRef = useRef<string[]>([]);
  // Track which group's data has been loaded to prevent stale debounced syncs
  const loadedGroupIdRef = useRef<string | null>(null);

  // Hydrate player data from cache on mount (or from active group when groups enabled)
  useEffect(() => {
    if (groupsState.enabled && activeGroup) {
      // Mark the group as not-yet-loaded to block stale debounced syncs
      loadedGroupIdRef.current = null;
      setPlayerCount(activeGroup.playerCount);
      setPlayerNames(activeGroup.playerNames);
      prevPlayerNamesRef.current = [...activeGroup.playerNames];
      currentPlayerNamesRef.current = [...activeGroup.playerNames];
      // Guard: only call loadGroupData after ScoreTrackerContext finishes its own
      // cache hydration, otherwise the appCache load will overwrite our null back
      // to stale data.
      if (!isLoading) {
        loadGroupData(activeGroup.gameScore ?? null, activeGroup.leaderboard ?? []);
        // Mark this group as loaded so debounced sync can proceed
        loadedGroupIdRef.current = activeGroup.id;

        // Detect renames: compare group's current playerNames against names in score data.
        // Must run AFTER loadGroupData so renamePlayer operates on the loaded state.
        const scorePlayerNames = extractPlayerNamesFromScores(
          activeGroup.gameScore ?? null,
          activeGroup.leaderboard ?? [],
        );
        if (scorePlayerNames.length > 0) {
          const limit = Math.min(scorePlayerNames.length, activeGroup.playerNames.length);
          for (let i = 0; i < limit; i++) {
            if (scorePlayerNames[i] && activeGroup.playerNames[i] && scorePlayerNames[i] !== activeGroup.playerNames[i]) {
              renamePlayer(scorePlayerNames[i], activeGroup.playerNames[i]);
            }
          }
        }
      }
      return;
    }
    if (isLoading) return;
    (async () => {
      const [pc, names, scoreData, leaderboardData] = await Promise.all([
        appCache.getPlayerCount(4),
        appCache.getPlayers([]),
        appCache.getGameScore(),
        appCache.getLeaderboard(),
      ]);

      // When score data exists, derive player count from it (the shared cache
      // may have been overwritten by Turn Selector / Team Randomizer).
      const scorePlayerNames = extractPlayerNamesFromScores(scoreData, leaderboardData);
      const effectiveCount = scorePlayerNames.length > 0 ? scorePlayerNames.length : pc;

      setPlayerCount(effectiveCount);
      const freshNames = names.length > 0
        ? Array.from({ length: effectiveCount }, (_, i) => names[i] || `P${i + 1}`)
        : Array.from({ length: effectiveCount }, (_, i) => `P${i + 1}`);

      // Detect renames by comparing cache names against names stored in score data.
      // Score data keys reflect the "old" names before any external rename (e.g. Turn Selector).
      if (scorePlayerNames.length > 0) {
        const limit = Math.min(scorePlayerNames.length, freshNames.length);
        for (let i = 0; i < limit; i++) {
          if (scorePlayerNames[i] && freshNames[i] && scorePlayerNames[i] !== freshNames[i]) {
            renamePlayer(scorePlayerNames[i], freshNames[i]);
          }
        }
      }

      setPlayerNames(freshNames);
      prevPlayerNamesRef.current = [...freshNames];
      currentPlayerNamesRef.current = [...freshNames];
    })();
  }, [groupsState.enabled, activeGroup?.id, loadGroupData, isLoading, renamePlayer]);

  // Persist player count changes
  useEffect(() => {
    appCache.setPlayerCount(playerCount);
  }, [playerCount]);

  // Persist player names with debounce
  useDebouncedEffect(() => {
    appCache.setPlayers(playerNames);
  }, [playerNames], 400);

  // When groups are enabled, sync score tracker state back to the active group
  // so that navigating away and back doesn't lose changes.
  useDebouncedEffect(() => {
    if (groupsState.enabled && activeGroup && !isLoading && loadedGroupIdRef.current === activeGroup.id) {
      updateActiveGroupData({ gameScore, leaderboard });
    }
  }, [gameScore, leaderboard], 400);

  // When returning from another screen, detect renames and sync.
  // Handles both group and non-group modes.
  useFocusEffect(
    useCallback(() => {
      if (isLoading) return;

      // Groups mode: detect renames from CreateGroup screen edits
      if (groupsState.enabled && activeGroup) {
        const scorePlayerNames = extractPlayerNamesFromScores(
          activeGroup.gameScore ?? null,
          activeGroup.leaderboard ?? [],
        );
        if (scorePlayerNames.length > 0) {
          const limit = Math.min(scorePlayerNames.length, activeGroup.playerNames.length);
          for (let i = 0; i < limit; i++) {
            if (scorePlayerNames[i] && activeGroup.playerNames[i] && scorePlayerNames[i] !== activeGroup.playerNames[i]) {
              renamePlayer(scorePlayerNames[i], activeGroup.playerNames[i]);
            }
          }
        }
        setPlayerCount(activeGroup.playerCount);
        setPlayerNames(activeGroup.playerNames);
        prevPlayerNamesRef.current = [...activeGroup.playerNames];
        currentPlayerNamesRef.current = [...activeGroup.playerNames];
        return;
      }

      // Non-group mode: detect renames from Turn Selector / Team Randomizer
      (async () => {
        const [pc, names, scoreData, leaderboardData] = await Promise.all([
          appCache.getPlayerCount(4),
          appCache.getPlayers([]),
          appCache.getGameScore(),
          appCache.getLeaderboard(),
        ]);
        if (names.length === 0) return;

        // When score data exists, derive player count from it
        const scorePlayerNames = extractPlayerNamesFromScores(scoreData, leaderboardData);
        const effectiveCount = scorePlayerNames.length > 0 ? scorePlayerNames.length : pc;

        const fresh = Array.from({ length: effectiveCount }, (_, i) => names[i] || `P${i + 1}`);
        const prev = prevPlayerNamesRef.current;

        // Only apply renames if we have a baseline to compare against
        if (prev.length > 0) {
          const limit = Math.min(prev.length, fresh.length);
          for (let i = 0; i < limit; i++) {
            if (prev[i] && fresh[i] && prev[i] !== fresh[i]) {
              renamePlayer(prev[i], fresh[i]);
            }
          }
        }

        setPlayerCount(effectiveCount);
        setPlayerNames(fresh);
        prevPlayerNamesRef.current = [...fresh];
        currentPlayerNamesRef.current = [...fresh];
      })();
    }, [groupsState.enabled, activeGroup, isLoading, renamePlayer])
  );

  const handleNameChange = useCallback((index: number, newName: string) => {
    // Update local state and current ref — rename happens on blur
    setPlayerNames(prev => {
      const updated = [...prev];
      updated[index] = newName;
      currentPlayerNamesRef.current = updated;
      return updated;
    });
  }, []);

  const handleNameBlur = useCallback((index: number) => {
    const currentName = currentPlayerNamesRef.current[index];
    const oldName = prevPlayerNamesRef.current[index];

    // If both non-empty and different, rename across stored score data
    if (oldName && currentName && oldName !== currentName) {
      renamePlayer(oldName, currentName);
    }

    // Commit the current name as the "last known" name
    if (currentName) {
      prevPlayerNamesRef.current[index] = currentName;
    }
  }, [renamePlayer]);

  const applyPlayerCountChange = (newCount: number) => {
    setPlayerCount(newCount);
    const newNames = Array.from({ length: newCount }, (_, j) => playerNames[j] || `P${j + 1}`);
    setPlayerNames(newNames);
    // Update refs for rename tracking
    prevPlayerNamesRef.current = [...newNames];
    currentPlayerNamesRef.current = [...newNames];
  };

  const showPlayerCountPicker = () => {
    const hasData = gameScore !== null || leaderboard.length > 0;
    
    Alert.alert(
      'Select Number of Players',
      '',
      [
        ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => ({
          text: `${i + 2}`,
          onPress: () => {
            const newCount = i + 2;
            
            // If there's existing data and count is changing, confirm first
            if (hasData && newCount !== playerCount) {
              Alert.alert(
                'Reset Score Data?',
                'Changing the number of players will clear all game scores and leaderboard data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset & Change',
                    style: 'destructive',
                    onPress: () => {
                      clearGameScore();
                      clearLeaderboard();
                      applyPlayerCountChange(newCount);
                    },
                  },
                ]
              );
            } else {
              applyPlayerCountChange(newCount);
            }
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
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>Score Tracker</Text>

          {/* Player Names Section */}
          {groupsState.enabled ? (
            <View style={{ marginTop: 12 }}>
              <GroupPicker onManageGroups={() => navigation.navigate('ManageGroups')} rowJustify="center" />
            </View>
          ) : (
            <>
              <PlayerNamesSection
                playerCount={playerCount}
                playerNames={playerNames}
                onPlayerCountPress={showPlayerCountPicker}
                onNameChange={handleNameChange}
                onNameBlur={handleNameBlur}
              />
              <EnableGroupsToggle onEnabled={() => navigation.navigate('ManageGroups')} marginTop={-26} switchScale={0.7} />
            </>
          )}

          {/* Game Score Section */}
          {hasGameScore && (
            <View style={{ marginTop: 16 }}>
              <GameScoreSection playerNames={playerNames.slice(0, playerCount)} />
            </View>
          )}

          {/* Leaderboard Section */}
          {hasLeaderboard && (
            <View style={{ marginTop: hasGameScore ? 4 : 16 }}>
              <LeaderboardSection playerNames={playerNames.slice(0, playerCount)} />
            </View>
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
              style={styles.secondaryButton}
              onPress={handleAddLeaderboardScore}
              testID="add-leaderboard-button"
            >
              <Text style={styles.secondaryButtonText}>🏆 Add Leaderboard Score</Text>
            </TouchableOpacity>
          )}

          {!hasGameScore && hasLeaderboard && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleAddGameScore}
              testID="add-game-score-button"
            >
              <Text style={styles.secondaryButtonText}>➕ Add Game Score</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}
