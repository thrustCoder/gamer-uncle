import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createGroupStyles as styles } from '../styles/createGroupStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { usePlayerGroups } from '../store/PlayerGroupsContext';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';

const MAX_PLAYERS = 20;
const MAX_NAMED_PLAYERS = 12;

export default function CreateGroupScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { state, createGroup, updateGroup } = usePlayerGroups();

  const editGroupId: string | undefined = route.params?.groupId;
  const existingGroup = editGroupId ? state.groups.find((g) => g.id === editGroupId) : undefined;
  const isEditMode = !!existingGroup;

  const [groupName, setGroupName] = useState(existingGroup?.name ?? '');
  const [playerCount, setPlayerCount] = useState(existingGroup?.playerCount ?? 4);
  const [playerNames, setPlayerNames] = useState<string[]>(
    existingGroup?.playerNames?.length
      ? existingGroup.playerNames
      : Array.from({ length: existingGroup?.playerCount ?? 4 }, (_, i) => `P${i + 1}`)
  );
  const [nameError, setNameError] = useState('');

  const handlePlayerCountChange = (newCount: number) => {
    setPlayerCount(newCount);
    setPlayerNames(
      Array.from({ length: newCount }, (_, i) => playerNames[i] || `P${i + 1}`)
    );
  };

  const showPlayerCountPicker = () => {
    Alert.alert(
      'Select Number of Players',
      '',
      [
        ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => ({
          text: `${i + 2}`,
          onPress: () => handlePlayerCountChange(i + 2),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleNameChange = (index: number, text: string) => {
    const updated = [...playerNames];
    updated[index] = text;
    setPlayerNames(updated);
  };

  const handleSave = () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setNameError('Group name is required');
      return;
    }
    setNameError('');

    const finalNames = playerCount <= MAX_NAMED_PLAYERS
      ? playerNames.slice(0, playerCount)
      : Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);

    if (isEditMode && editGroupId) {
      updateGroup(editGroupId, {
        name: trimmedName,
        playerCount,
        playerNames: finalNames,
      });
    } else {
      createGroup(trimmedName, playerCount, finalNames);
      trackEvent(AnalyticsEvents.PLAYER_GROUP_CREATED, { name: trimmedName, playerCount: String(playerCount) });
    }

    navigation.goBack();
  };

  const showNameInputs = playerCount <= MAX_NAMED_PLAYERS;

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
            <Text style={styles.title}>
              {isEditMode ? 'Edit Group' : 'Create Group'}
            </Text>

            {/* Group Name */}
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Friday Night Crew"
              placeholderTextColor={Colors.grayDark}
              value={groupName}
              onChangeText={(text) => { setGroupName(text); setNameError(''); }}
              autoCapitalize="words"
              testID="group-name-input"
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

            {/* Number of Players */}
            <View style={styles.playerCountRow}>
              <Text style={styles.label}>Number of Players</Text>
              <TouchableOpacity
                style={styles.playerCountButton}
                onPress={showPlayerCountPicker}
                testID="group-player-count-button"
              >
                <Text style={styles.playerCountText}>{playerCount}</Text>
              </TouchableOpacity>
            </View>

            {/* Player Name Inputs */}
            {showNameInputs && (
              <View style={styles.nameInputsGrid}>
                {Array.from({ length: playerCount }).map((_, i) => (
                  <TextInput
                    key={i}
                    style={[
                      styles.nameInput,
                      playerCount > 6 && styles.nameInputNarrow,
                    ]}
                    placeholder={`Player ${i + 1}`}
                    placeholderTextColor={Colors.grayDark}
                    value={playerNames[i] ?? ''}
                    onChangeText={(text) => handleNameChange(i, text)}
                    testID={`group-player-name-${i}`}
                  />
                ))}
              </View>
            )}

            {!showNameInputs && (
              <Text style={styles.manyPlayersText}>
                {playerCount} players configured — naming available for {MAX_NAMED_PLAYERS} or fewer
              </Text>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              testID="save-group-button"
            >
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Save Changes' : 'Create Group'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
    </ImageBackground>
  );
}
