import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { Colors } from '../styles/colors';
import { usePlayerGroups } from '../store/PlayerGroupsContext';
import { useScoreTracker } from '../store/ScoreTrackerContext';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';

interface GroupPickerProps {
  onManageGroups: () => void;
}

export default function GroupPicker({ onManageGroups }: GroupPickerProps) {
  const { state, activeGroup, setActiveGroup } = usePlayerGroups();
  const { gameScore } = useScoreTracker();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleSelectGroup = (groupId: string) => {
    if (groupId === state.activeGroupId) {
      setDropdownVisible(false);
      return;
    }

    const doSwitch = () => {
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
      backgroundColor: 'rgba(139, 69, 19, 0.3)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    }}>
      {/* Dropdown trigger */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.themeYellow, fontSize: 14, fontWeight: '600' }}>
          Active Group
        </Text>
        <TouchableOpacity
          onPress={() => setDropdownVisible(true)}
          style={{
            backgroundColor: Colors.themeBrownDark,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: Colors.themeYellow,
            flexDirection: 'row',
            alignItems: 'center',
          }}
          testID="group-picker-dropdown"
        >
          <Text style={{ color: Colors.themeYellow, fontSize: 14, fontWeight: 'bold', marginRight: 6 }}>
            {activeGroup?.name ?? 'Select Group'}
          </Text>
          <Text style={{ color: Colors.themeYellow, fontSize: 12 }}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Manage Groups link */}
      <TouchableOpacity
        onPress={onManageGroups}
        style={{ marginTop: 8, alignSelf: 'flex-end' }}
        testID="manage-groups-link"
      >
        <Text style={{ color: Colors.themeYellow, fontSize: 13, textDecorationLine: 'underline' }}>
          Manage Groups →
        </Text>
      </TouchableOpacity>

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
