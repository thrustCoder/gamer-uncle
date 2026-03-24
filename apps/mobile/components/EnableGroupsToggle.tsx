import React from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { Colors } from '../styles/colors';
import { usePlayerGroups } from '../store/PlayerGroupsContext';

interface EnableGroupsToggleProps {
  onEnabled: () => void;
  labelFontSize?: number;
}

export default function EnableGroupsToggle({ onEnabled, labelFontSize = 20 }: EnableGroupsToggleProps) {
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
        paddingVertical: 4,
        marginTop: 0,
      }}
      testID="enable-groups-toggle"
    >
      <Text style={{
        color: Colors.themeYellow,
        fontSize: labelFontSize,
        fontWeight: 'bold',
        textShadowColor: Colors.black,
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
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
