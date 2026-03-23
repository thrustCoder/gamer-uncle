import React from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { Colors } from '../styles/colors';
import { usePlayerGroups } from '../store/PlayerGroupsContext';

interface EnableGroupsToggleProps {
  onEnabled: () => void;
}

export default function EnableGroupsToggle({ onEnabled }: EnableGroupsToggleProps) {
  const { enableGroups } = usePlayerGroups();

  const handleToggle = () => {
    Alert.alert(
      'Enable Player Groups',
      'You are about to enable player groups. This lets you manage different groups of players for different game nights. Your current players and data will be moved into the first group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await enableGroups();
            onEnabled();
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(139, 69, 19, 0.3)',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 12,
      }}
      testID="enable-groups-toggle"
    >
      <Text style={{
        color: Colors.themeYellow,
        fontSize: 14,
        fontWeight: '600',
      }}>
        Enable Player Groups
      </Text>
      <Switch
        value={false}
        onValueChange={handleToggle}
        trackColor={{ false: Colors.grayDark, true: Colors.themeGreen }}
        thumbColor={Colors.white}
        testID="enable-groups-switch"
      />
    </TouchableOpacity>
  );
}
