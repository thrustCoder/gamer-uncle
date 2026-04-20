import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { manageGroupsStyles as styles } from '../styles/manageGroupsStyles';
import BackButton from '../components/BackButton';
import { usePlayerGroups } from '../store/PlayerGroupsContext';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';
import { MAX_GROUPS } from '../types/playerGroups';

export default function ManageGroupsScreen() {
  const navigation = useNavigation<any>();
  const { state, activeGroup, setActiveGroup, deleteGroup, disableGroups } = usePlayerGroups();

  const handleSelectGroup = (groupId: string) => {
    if (groupId === state.activeGroupId) return;
    setActiveGroup(groupId);
    trackEvent(AnalyticsEvents.PLAYER_GROUP_SWITCHED, { groupId });
  };

  const handleEditGroup = (groupId: string) => {
    navigation.navigate('CreateGroup', { groupId });
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (state.groups.length <= 1) {
      Alert.alert(
        'Cannot Delete',
        'You must have at least one group while groups are enabled. To remove groups, use "Disable Player Groups" below.',
      );
      return;
    }

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${groupName}"? All its data (scores, leaderboard, game setup) will be permanently lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteGroup(groupId);
            trackEvent(AnalyticsEvents.PLAYER_GROUP_DELETED, { groupId });
          },
        },
      ]
    );
  };

  const handleDisableGroups = () => {
    Alert.alert(
      'Disable Player Groups',
      'All groups and their data will be deleted except the currently active group. The active group\'s players and data will be kept as ungrouped players.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await disableGroups();
            trackEvent(AnalyticsEvents.PLAYER_GROUPS_DISABLED);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleCreateGroup = () => {
    navigation.navigate('CreateGroup', {});
  };

  const canCreateMore = state.groups.length < MAX_GROUPS;

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
      >
        <View style={styles.container}>
          <Text style={styles.title}>Player Groups</Text>

          {state.groups.map((group) => {
            const isActive = group.id === state.activeGroupId;
            return (
              <TouchableOpacity
                key={group.id}
                style={[styles.groupCard, isActive && styles.groupCardActive]}
                onPress={() => handleSelectGroup(group.id)}
                testID={`group-card-${group.id}`}
              >
                <View style={styles.groupCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>🎲 {group.name}</Text>
                    <Text style={styles.groupPlayerCount}>{group.playerCount} players</Text>
                    {isActive && <Text style={styles.activeLabel}>Active</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleEditGroup(group.id)}
                    testID={`edit-group-${group.id}`}
                  >
                    <Text style={styles.iconText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteGroup(group.id, group.name)}
                    testID={`delete-group-${group.id}`}
                  >
                    <Text style={styles.iconText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Create New Group */}
          <TouchableOpacity
            style={[styles.createButton, !canCreateMore && styles.createButtonDisabled]}
            onPress={handleCreateGroup}
            disabled={!canCreateMore}
            testID="create-new-group-button"
          >
            <Text style={styles.createButtonText}>+ Create New Group</Text>
          </TouchableOpacity>
          {!canCreateMore && (
            <Text style={styles.maxGroupsText}>Maximum {MAX_GROUPS} groups reached</Text>
          )}

          {/* Separator */}
          <View style={styles.separator} />

          {/* Disable Groups */}
          <TouchableOpacity
            style={styles.disableButton}
            onPress={handleDisableGroups}
            testID="disable-groups-button"
          >
            <Text style={styles.disableButtonText}>⚠️ Disable Player Groups</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}
