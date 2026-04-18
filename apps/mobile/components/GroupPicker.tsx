import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { Colors } from '../styles/colors';
import { usePlayerGroups } from '../store/PlayerGroupsContext';
import { useScoreTracker } from '../store/ScoreTrackerContext';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';

interface GroupPickerProps {
  onManageGroups: () => void;
  labelFontSize?: number;
  labelFontWeight?: string;
  labelColor?: string;
  useTextShadow?: boolean;
  textShadowStrong?: boolean;
  rowJustify?: 'flex-start' | 'center' | 'space-between';
  containerMarginBottom?: number;
}

export default function GroupPicker({ onManageGroups, labelFontSize = 20, labelFontWeight = 'bold', labelColor, useTextShadow = true, textShadowStrong = false, rowJustify = 'flex-start', containerMarginBottom = 15 }: GroupPickerProps) {
  const { state, activeGroup, setActiveGroup, updateActiveGroupData } = usePlayerGroups();
  const { gameScore, leaderboard, loadGroupData } = useScoreTracker();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleSelectGroup = (groupId: string) => {
    if (groupId === state.activeGroupId) {
      setDropdownVisible(false);
      return;
    }

    const doSwitch = () => {
      // Save current score state to the outgoing group before switching
      updateActiveGroupData({ gameScore, leaderboard });
      // Eagerly load the new group's score data BEFORE switching.
      // This prevents a transient render where the old group's scores
      // are displayed with the new group's player names.
      const newGroup = state.groups.find((g) => g.id === groupId);
      loadGroupData(newGroup?.gameScore ?? null, newGroup?.leaderboard ?? []);
      setActiveGroup(groupId);
      trackEvent(AnalyticsEvents.PLAYER_GROUP_SWITCHED, {
        groupId,
      });
      setDropdownVisible(false);
    };

    // Warn if ScoreTracker has an active session
    if (gameScore !== null) {
      Alert.alert(
        'Switch Group?',
        'Switching will save your current session and load the selected group\'s data.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setDropdownVisible(false) },
          { text: 'Switch', onPress: doSwitch },
        ]
      );
    } else {
      doSwitch();
    }
  };

  return (
    <View style={{
      marginBottom: containerMarginBottom,
    }}>
      {/* Dropdown trigger with gear icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: rowJustify }}>
        <Text style={{
          fontSize: labelFontSize,
          fontWeight: labelFontWeight as any,
          color: labelColor || Colors.themeYellow,
          ...(useTextShadow ? {
            textShadowColor: Colors.black,
            textShadowOffset: textShadowStrong ? { width: 2, height: 2 } : { width: 1, height: 1 },
            textShadowRadius: textShadowStrong ? 4 : 2,
          } : {}),
        }}>
          Active Group
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
          <TouchableOpacity
            onPress={() => setDropdownVisible(true)}
            style={{
              backgroundColor: Colors.themeBrownDark,
              borderRadius: 7,
              paddingHorizontal: 14,
              height: 30,
              borderWidth: 2,
              borderColor: Colors.themeYellow,
              flexDirection: 'row',
              alignItems: 'center',
            }}
            testID="group-picker-dropdown"
          >
            <Text style={{ color: Colors.themeYellow, fontSize: 15, fontWeight: 'bold', marginRight: 6, maxWidth: 100 }} numberOfLines={1} ellipsizeMode="tail">
              {activeGroup?.name ?? 'Select Group'}
            </Text>
            <Text style={{ color: Colors.themeYellow, fontSize: 12 }}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onManageGroups}
            style={{ marginLeft: 10, padding: 4 }}
            testID="manage-groups-link"
          >
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown modal */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={{
            backgroundColor: '#2a1a0a',
            borderRadius: 12,
            width: '80%',
            maxHeight: '60%',
            borderWidth: 2,
            borderColor: Colors.themeYellow,
          }}>
            <Text style={{
              color: Colors.themeYellow,
              fontSize: 18,
              fontWeight: 'bold',
              padding: 16,
              textAlign: 'center',
            }}>
              Select Group
            </Text>
            <FlatList
              data={state.groups}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectGroup(item.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: item.id === state.activeGroupId ? 'rgba(251, 232, 201, 0.15)' : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(251, 232, 201, 0.1)',
                  }}
                >
                  <Text style={{
                    color: Colors.themeYellow,
                    fontSize: 16,
                    fontWeight: item.id === state.activeGroupId ? 'bold' : 'normal',
                  }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: Colors.grayDark, fontSize: 13, marginTop: 2 }}>
                    {item.playerCount} players
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
