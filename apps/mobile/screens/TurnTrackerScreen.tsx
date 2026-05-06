import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  ImageBackground,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import BackButton from '../components/BackButton';
import GroupPicker from '../components/GroupPicker';
import DirectionToggle from '../components/turnTracker/DirectionToggle';
import PlayerPickerModal from '../components/turnTracker/PlayerPickerModal';
import SeatingCircle from '../components/turnTracker/SeatingCircle';
import { appCache } from '../services/storage/appCache';
import { AnalyticsEvents, trackEvent } from '../services/Telemetry';
import { playTurnTickSound } from '../services/turnTrackerSound';
import { Colors } from '../styles/colors';
import { turnTrackerStyles as styles } from '../styles/turnTrackerStyles';
import { usePlayerGroups } from '../store/PlayerGroupsContext';
import { useTurnTracker } from '../store/TurnTrackerContext';
import type { TurnDirection } from '../types/turnTracker';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = Math.min(screenWidth, screenHeight) >= 768;

const STAGE_SIZE = Math.min(screenWidth, screenHeight) * (isTablet ? 0.62 : 0.78);
const SEAT_SIZE = isTablet ? 96 : 64;
const MARKER_SIZE = isTablet ? 96 : 72;

/**
 * Top padding for the scrollable content. Must clear the absolute-positioned
 * page header (which sits at top: 57). 140 px gives the GroupPicker / subtitle
 * plenty of breathing room below the header.
 */
const CONTENT_TOP_PADDING = 140;

export default function TurnTrackerScreen() {
  const navigation = useNavigation<any>();
  const { state: groupsState, activeGroup } = usePlayerGroups();
  const {
    session,
    isLoading,
    activeSeatIndex,
    nextSeatIndex,
    prevSeatIndex,
    beginGame,
    endGame,
    advanceTurn,
    retractTurn,
    setDirection,
  } = useTurnTracker();

  const inGame = session !== null;

  // ── Active player list (group or appCache) ──────────────────
  const [appCachePlayers, setAppCachePlayers] = useState<string[]>([]);
  const [appCachePlayerCount, setAppCachePlayerCount] = useState<number>(4);

  const loadAppCachePlayers = useCallback(async () => {
    const [pc, names] = await Promise.all([
      appCache.getPlayerCount(4),
      appCache.getPlayers([]),
    ]);
    setAppCachePlayerCount(pc);
    setAppCachePlayers(
      names.length > 0
        ? Array.from({ length: pc }, (_, i) => names[i] || `P${i + 1}`)
        : Array.from({ length: pc }, (_, i) => `P${i + 1}`)
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!groupsState.enabled) {
        loadAppCachePlayers();
      }
    }, [groupsState.enabled, loadAppCachePlayers])
  );

  useEffect(() => {
    if (!groupsState.enabled) {
      loadAppCachePlayers();
    }
  }, [groupsState.enabled, loadAppCachePlayers]);

  const playerNames: string[] = useMemo(() => {
    if (groupsState.enabled && activeGroup) {
      const desired = activeGroup.playerCount;
      const base = activeGroup.playerNames.slice(0, desired);
      while (base.length < desired) base.push(`P${base.length + 1}`);
      return base;
    }
    return appCachePlayers;
  }, [groupsState.enabled, activeGroup, appCachePlayers]);

  const playerCount = groupsState.enabled
    ? activeGroup?.playerCount ?? 0
    : appCachePlayerCount;

  const getPlayerName = useCallback(
    (playerIndex: number): string =>
      playerNames[playerIndex] ?? `P${playerIndex + 1}`,
    [playerNames]
  );

  // ── Setup state (transient — not persisted) ────────────────
  const [seats, setSeats] = useState<(number | null)[]>([]);

  // Reset the seating draft whenever the player list size changes (new group, etc.)
  // OR after a game ends (session goes from non-null to null).
  const lastInGameRef = useRef(inGame);
  useEffect(() => {
    if (!inGame) {
      const justEndedGame = lastInGameRef.current && !inGame;
      // Only reset when player count differs from current draft length, or game just ended.
      if (seats.length !== playerCount || justEndedGame) {
        setSeats(Array.from({ length: playerCount }, () => null));
      }
    }
    lastInGameRef.current = inGame;
  }, [inGame, playerCount, seats.length]);

  // ── Player picker modal ───────────────────────────────────
  const [pickerSeatIndex, setPickerSeatIndex] = useState<number | null>(null);

  /**
   * Measured inner width of the in-game CTA row (Add Score + Timer). Used to
   * size the End Game button so it spans exactly the combined width of the
   * two pills above it. Stays at 0 until the row has been laid out.
   */
  const [ctaRowWidth, setCtaRowWidth] = useState<number>(0);

  const seatedPlayerIndices = useMemo(
    () => seats.filter((s): s is number => s != null),
    [seats]
  );

  const allSeatsFilled =
    playerCount > 0 && seats.length === playerCount && seats.every((s) => s != null);

  /** True when no seat has been assigned yet (used to show the "Pick First Turn" CTA). */
  const noSeatsFilled =
    seats.length === 0 || seats.every((s) => s == null);

  // ── Setup actions ──────────────────────────────────────────
  const handleSeatPress = useCallback((seatIdx: number) => {
    setPickerSeatIndex(seatIdx);
  }, []);

  const handlePickPlayer = useCallback((playerIndex: number) => {
    if (pickerSeatIndex == null) return;
    setSeats((prev) => {
      const next = [...prev];
      next[pickerSeatIndex] = playerIndex;
      return next;
    });
    setPickerSeatIndex(null);
  }, [pickerSeatIndex]);

  const handleClearSeat = useCallback(() => {
    if (pickerSeatIndex == null) return;
    setSeats((prev) => {
      const next = [...prev];
      next[pickerSeatIndex] = null;
      return next;
    });
    setPickerSeatIndex(null);
  }, [pickerSeatIndex]);

  const handleBeginGame = useCallback(() => {
    if (!allSeatsFilled) return;
    const seatOrder = seats as number[];
    beginGame(seatOrder, 'cw');
    trackEvent(AnalyticsEvents.TURN_TRACKER_GAME_STARTED, {
      direction: 'cw',
      source: groupsState.enabled ? 'groups' : 'appCache',
    }, {
      playerCount,
    });
  }, [allSeatsFilled, beginGame, groupsState.enabled, playerCount, seats]);

  // ── In-game actions ────────────────────────────────────────
  const handleMarkerPress = useCallback(() => {
    advanceTurn();
    playTurnTickSound();
    trackEvent(AnalyticsEvents.TURN_TRACKER_TURN_ADVANCED, {
      via: 'marker',
      direction: session?.direction ?? 'cw',
    }, {
      activeSeatIndex: ((activeSeatIndex ?? 0) + (session?.direction === 'ccw' ? -1 : 1) + playerCount) % playerCount,
    });
  }, [advanceTurn, session?.direction, activeSeatIndex, playerCount]);

  const handleAdvancePress = useCallback(() => {
    advanceTurn();
    playTurnTickSound();
    trackEvent(AnalyticsEvents.TURN_TRACKER_TURN_ADVANCED, {
      via: 'seatTap',
      direction: session?.direction ?? 'cw',
    }, {
      activeSeatIndex: ((activeSeatIndex ?? 0) + (session?.direction === 'ccw' ? -1 : 1) + playerCount) % playerCount,
    });
  }, [advanceTurn, session?.direction, activeSeatIndex, playerCount]);

  const handleRetractPress = useCallback(() => {
    retractTurn();
    playTurnTickSound();
    trackEvent(AnalyticsEvents.TURN_TRACKER_TURN_RETRACTED, {
      via: 'seatTap',
      direction: session?.direction ?? 'cw',
    }, {
      activeSeatIndex: ((activeSeatIndex ?? 0) - (session?.direction === 'ccw' ? -1 : 1) + playerCount) % playerCount,
    });
  }, [retractTurn, session?.direction, activeSeatIndex, playerCount]);

  const handleDirectionChange = useCallback((dir: TurnDirection) => {
    if (!session) return;
    if (session.direction === dir) return;
    trackEvent(AnalyticsEvents.TURN_TRACKER_DIRECTION_FLIPPED, {
      from: session.direction,
      to: dir,
    });
    setDirection(dir);
  }, [session, setDirection]);

  const handleEndGame = useCallback(() => {
    Alert.alert(
      'End game?',
      'This clears the turn tracker for this group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            const ended = endGame();
            if (ended) {
              const durationSeconds = Math.max(0, Math.floor((Date.now() - ended.startedAt) / 1000));
              trackEvent(AnalyticsEvents.TURN_TRACKER_GAME_ENDED, {
                direction: ended.direction,
              }, {
                playerCount: ended.playerCountAtStart,
                durationSeconds,
                totalAdvances: ended.totalAdvances,
                totalRetracts: ended.totalRetracts,
              });
            }
          },
        },
      ]
    );
  }, [endGame]);

  // ── Navigation handlers ────────────────────────────────────
  const goToPickTurn = useCallback(() => navigation.navigate('Turn'), [navigation]);
  const goToTimer = useCallback(() => navigation.navigate('Timer'), [navigation]);
  const goToScoreTracker = useCallback(() => navigation.navigate('ScoreTracker'), [navigation]);
  const goToManageGroups = useCallback(() => navigation.navigate('ManageGroups'), [navigation]);

  // ── Render guards ──────────────────────────────────────────
  if (isLoading) {
    return (
      <ImageBackground
        source={require('../assets/images/tool_background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <BackButton />
        <Text style={styles.pageHeader}>Track Turns</Text>
      </ImageBackground>
    );
  }

  const validPlayerCount = playerCount >= 2 && playerCount <= 20;

  // ── Setup view ─────────────────────────────────────────────
  const renderSetup = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 10,
        paddingTop: CONTENT_TOP_PADDING,
        paddingBottom: 60,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {groupsState.enabled && (
        <View style={styles.groupPickerWrap}>
          <GroupPicker onManageGroups={goToManageGroups} rowJustify="center" />
        </View>
      )}

      <Text style={styles.subtitle}>
        {validPlayerCount
          ? 'Tap to seat players in turn order'
          : `Add 2–20 players in your ${groupsState.enabled ? 'group' : 'player list'} first.`}
      </Text>

      {validPlayerCount && (
        <SeatingCircle
          inGame={false}
          playerCount={playerCount}
          seats={seats}
          getPlayerName={getPlayerName}
          onSeatPress={handleSeatPress}
          stageSize={STAGE_SIZE}
          seatSize={SEAT_SIZE}
          markerSize={MARKER_SIZE}
        />
      )}

      {/*
       * Setup-mode action row:
       *   - When every seat is empty: [Pick First Turn] [Begin Game] sit
       *     side-by-side, splitting the available width evenly.
       *   - Once any seat is assigned (Pick First Turn vanishes): Begin Game
       *     stretches to span the full row width.
       *   - Begin Game stays disabled until every seat is filled.
       */}
      {validPlayerCount && (
        <View style={styles.setupCtaRow}>
          {noSeatsFilled && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.primaryButtonFlex, styles.primaryButtonSecondary]}
              onPress={goToPickTurn}
              testID="cta-pick-turn"
              accessibilityRole="button"
              accessibilityLabel="Open random Pick Turns spinner to pick the first turn"
            >
              <Text style={styles.primaryButtonText}>Pick First Turn</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.primaryButtonFlex,
              !allSeatsFilled && styles.primaryButtonDisabled,
            ]}
            disabled={!allSeatsFilled}
            onPress={handleBeginGame}
            testID="begin-game-button"
            {...(Platform.OS === 'web' && { 'data-testid': 'begin-game-button' })}
          >
            <Text style={styles.primaryButtonText}>Begin Game</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  // ── In-game view ───────────────────────────────────────────
  const renderInGame = () => {
    if (!session) return null;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 10,
          paddingTop: CONTENT_TOP_PADDING,
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        {groupsState.enabled && (
          <View style={[styles.groupPickerWrap, { opacity: 0.55 }]} pointerEvents="none">
            <GroupPicker
              onManageGroups={goToManageGroups}
              rowJustify="center"
              containerMarginBottom={0}
            />
          </View>
        )}

        <SeatingCircle
          inGame
          seatOrder={session.seatOrder}
          getPlayerName={getPlayerName}
          activeSeatIndex={activeSeatIndex ?? 0}
          nextSeatIndex={nextSeatIndex ?? 0}
          prevSeatIndex={prevSeatIndex ?? 0}
          onMarkerPress={handleMarkerPress}
          onAdvancePress={handleAdvancePress}
          onRetractPress={handleRetractPress}
          stageSize={STAGE_SIZE}
          seatSize={SEAT_SIZE}
          markerSize={MARKER_SIZE}
        />

        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <DirectionToggle value={session.direction} onChange={handleDirectionChange} />
        </View>

        {/*
         * Bottom action block. The CTA row is wrapped together with the End
         * Game button so they share the same horizontal padding. We measure
         * the CTA row's rendered width via `onLayout` and apply it to the End
         * Game button so its width visually matches the combined span of the
         * two pills above it (Add Score + Timer) for a symmetric look.
         */}
        <View style={styles.endGameWrap}>
          <View
            style={styles.ctaRow}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              // Subtract the row's horizontal padding so the End Game button
              // matches the inner pills exactly. `paddingHorizontal: 8` on
              // ctaRow contributes 16 px of inset.
              const innerWidth = Math.max(0, w - 16);
              if (innerWidth !== ctaRowWidth) {
                setCtaRowWidth(innerWidth);
              }
            }}
          >
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={goToScoreTracker}
              testID="cta-add-game-score"
              accessibilityRole="button"
              accessibilityLabel="Add score"
            >
              <MaterialCommunityIcons name="scoreboard" size={20} color={Colors.white} />
              <Text style={styles.ctaButtonText}>Add Score</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctaButton, styles.ctaButtonAlt]}
              onPress={goToTimer}
              testID="cta-timer"
              accessibilityRole="button"
              accessibilityLabel="Open timer"
            >
              <Ionicons name="timer" size={20} color={Colors.white} />
              <Text style={styles.ctaButtonText}>Timer</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.endGameButton,
              ctaRowWidth > 0 && { width: ctaRowWidth },
            ]}
            onPress={handleEndGame}
            testID="end-game-button"
          >
            <Text style={styles.endGameText}>End Game</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <ImageBackground
      source={require('../assets/images/tool_background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <BackButton />
      <Text style={styles.pageHeader}>Track Turns</Text>

      <View style={{ flex: 1 }} testID="turn-tracker-screen">
        {inGame ? renderInGame() : renderSetup()}
      </View>

      {pickerSeatIndex != null && (
        <PlayerPickerModal
          visible
          playerNames={playerNames}
          seatedPlayerIndices={seatedPlayerIndices}
          currentSelection={seats[pickerSeatIndex] ?? null}
          seatNumber={pickerSeatIndex + 1}
          onPick={handlePickPlayer}
          onClear={seats[pickerSeatIndex] != null ? handleClearSeat : undefined}
          onClose={() => setPickerSeatIndex(null)}
        />
      )}
    </ImageBackground>
  );
}

