import React from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { Colors } from '../styles/colors';
import { usePlayerGroups } from '../store/PlayerGroupsContext';

interface EnableGroupsToggleProps {
  onEnabled: () => void;
  labelFontSize?: number;
  labelColor?: string;
  useTextShadow?: boolean;
  marginTop?: number;
}

export default function EnableGroupsToggle({ onEnabled, labelFontSize = 20, labelColor, useTextShadow = true, marginTop = -8 }: EnableGroupsToggleProps) {
  const { enableGroups } = usePlayerGroups();

  const handleToggle = () => {
    Alert.alert(
      'Create Player Groups',
      'You are about to create player groups. This lets you manage different groups of players for different game nights. Your current players and data will be moved into the first group.',
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
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 4,
        marginTop,
      }}
      testID="enable-groups-toggle"
    >
      <Text style={{
        color: labelColor || Colors.themeYellow,
        fontSize: labelFontSize,
        fontWeight: 'bold',
        ...(useTextShadow ? {
          textShadowColor: Colors.black,
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        } : {}),
      }}>
        Create player groups
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
