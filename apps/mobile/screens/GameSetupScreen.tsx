import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { gameSetupStyles as styles } from '../styles/gameSetupStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import MarkdownText from '../components/MarkdownText';
import RatingModal from '../components/RatingModal';
import { getRecommendations } from '../services/ApiClient';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';
import { useRatingPrompt } from '../hooks/useRatingPrompt';
import { appCache } from '../services/storage/appCache';
import GroupPicker from '../components/GroupPicker';
import { usePlayerGroups } from '../store/PlayerGroupsContext';

const MAX_PLAYERS = 20;

// Generate a unique user ID for the session
const generateUserId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function GameSetupScreen() {
  const navigation = useNavigation<any>();
  const { state: groupsState, activeGroup } = usePlayerGroups();
  const [gameName, setGameName] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [setupResponse, setSetupResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState(generateUserId());
  const [isHydrated, setIsHydrated] = useState(false);

  // Rating prompt
  const { showRatingModal, trackEngagement, handleRate, handleDismiss } =
    useRatingPrompt('gameSetup');

  // Restore persisted game setup state on mount (or from active group when groups enabled)
  useEffect(() => {
    if (groupsState.enabled && activeGroup) {
      // Always use the group's canonical playerCount — gameSetupPlayerCount may
      // carry a stale value from a prior ungrouped session baked in at group creation.
      setPlayerCount(activeGroup.playerCount);
      if (activeGroup.gameSetupGameName) setGameName(activeGroup.gameSetupGameName);
      if (activeGroup.gameSetupResponse) setSetupResponse(activeGroup.gameSetupResponse);
      setIsHydrated(true);
      return;
    }
    (async () => {
      const [savedName, savedCount, savedResponse] = await Promise.all([
        appCache.getGameSetupGameName(),
        appCache.getGameSetupPlayerCount(),
        appCache.getGameSetupResponse(),
      ]);
      if (savedName) setGameName(savedName);
      if (savedCount) setPlayerCount(savedCount);
      if (savedResponse) setSetupResponse(savedResponse);
      setIsHydrated(true);
    })();
  }, [groupsState.enabled, activeGroup?.id]);

  // Persist game name when it changes (after hydration)
  useEffect(() => {
    if (isHydrated) {
      appCache.setGameSetupGameName(gameName);
    }
  }, [gameName, isHydrated]);

  // Persist player count when it changes (after hydration)
  useEffect(() => {
    if (isHydrated) {
      appCache.setGameSetupPlayerCount(playerCount);
    }
  }, [playerCount, isHydrated]);

  const showPlayerCountPicker = () => {
    Alert.alert(
      "Select Number of Players",
      "",
      [
        ...Array.from({ length: MAX_PLAYERS }, (_, i) => ({
          text: `${i + 1}`,
          onPress: () => setPlayerCount(i + 1)
        })),
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleGetSetup = async () => {
    Keyboard.dismiss();
    if (!gameName.trim()) {
      Alert.alert('Missing Game Name', 'Please enter the name of the game.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSetupResponse(null);

    const prompt = `What is the initial game setup for ${gameName.trim()} with ${playerCount} player${playerCount > 1 ? 's' : ''}? 
Please provide step-by-step setup instructions including:
- Board/play area setup
- Initial card/piece distribution per player
- Starting positions
- Any player-count specific variations`;

    try {
      const response = await getRecommendations({
        Query: prompt,
        UserId: userId,
        ConversationId: null // Fresh conversation for each setup query
      });

      if (response && response.responseText) {
        setSetupResponse(response.responseText);
        // Persist the response for future visits
        await appCache.setGameSetupResponse(response.responseText);
        // Track engagement for rating prompt
        await trackEngagement();
      } else {
        trackEvent(AnalyticsEvents.ERROR_GAME_SETUP, {
          error: 'empty_response',
          gameName: gameName.trim(),
          playerCount: String(playerCount),
        });
        setError('No setup instructions received. Please try again.');
      }
    } catch (err: any) {
      trackEvent(AnalyticsEvents.ERROR_GAME_SETUP, {
        error: err.message || 'Unknown',
        gameName: gameName.trim(),
        playerCount: String(playerCount),
      });
      setError(err.message || 'Failed to get game setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNeedMoreHelp = () => {
    navigation.navigate('Chat', {
      prefillContext: {
        gameName: gameName.trim(),
        playerCount: playerCount,
        previousSetupQuery: true
      }
    });
  };

  const handleReset = async () => {
    setSetupResponse(null);
    setError(null);
    setGameName('');
    setPlayerCount(4);
    await appCache.clearGameSetup();
  };

  return (
    <ImageBackground
      source={require('../assets/images/tool_background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BackButton />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text style={styles.title}>Game Setup</Text>
          <Text style={styles.subtitle}>Get setup instructions for any board game</Text>

          {/* Input Section */}
          <View style={styles.inputSection}>
            {/* Game Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Game Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Catan, Ticket to Ride, Pandemic..."
                placeholderTextColor={Colors.grayDark}
                value={gameName}
                onChangeText={setGameName}
                autoCapitalize="words"
                autoCorrect={false}
                testID="game-name-input"
                {...(Platform.OS === 'web' && { 'data-testid': 'game-name-input' })}
              />
            </View>

            {/* Player Count Picker */}
            {groupsState.enabled ? (
              <View style={styles.inputGroup}>
                <GroupPicker onManageGroups={() => navigation.navigate('ManageGroups')} labelFontSize={18} labelFontWeight="600" />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Number of Players</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={showPlayerCountPicker}
                  testID="player-count-picker"
                  {...(Platform.OS === 'web' && { 'data-testid': 'player-count-picker' })}
                >
                  <Text style={styles.pickerButtonText}>
                    {playerCount} {playerCount === 1 ? 'Player' : 'Players'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Get Setup Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleGetSetup}
              disabled={isLoading}
              testID="get-setup-button"
              {...(Platform.OS === 'web' && { 'data-testid': 'get-setup-button' })}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={Colors.themeYellow} size="small" />
                  <Text style={styles.buttonText}>Getting Setup...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>🎲 Get Game Setup</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Response Section */}
          {setupResponse && (
            <View style={styles.responseSection}>
              <View style={styles.responseBubble}>
                <MarkdownText text={setupResponse} />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleNeedMoreHelp}
                  testID="need-more-help-button"
                  {...(Platform.OS === 'web' && { 'data-testid': 'need-more-help-button' })}
                >
                  <Text style={styles.secondaryButtonText}>💬 Need more help?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                  testID="reset-button"
                  {...(Platform.OS === 'web' && { 'data-testid': 'reset-button' })}
                >
                  <Text style={styles.resetButtonText}>🔄 New Game</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <RatingModal
        visible={showRatingModal}
        onRate={handleRate}
        onDismiss={handleDismiss}
      />
    </ImageBackground>
  );
}
