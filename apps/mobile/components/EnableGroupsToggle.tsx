import React from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { Colors } from '../styles/colors';
import { usePlayerGroups } from '../store/PlayerGroupsContext';

interface EnableGroupsToggleProps {
  onEnabled: () => void;
  labelFontSize?: number;
  labelFontWeight?: string;
  labelColor?: string;
  useTextShadow?: boolean;
  textShadowStrong?: boolean;
  marginTop?: number;
  switchScale?: number;
}

export default function EnableGroupsToggle({ onEnabled, labelFontSize = 20, labelFontWeight = 'bold', labelColor, useTextShadow = true, textShadowStrong = false, marginTop = -8, switchScale = 1 }: EnableGroupsToggleProps) {
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
        zIndex: 20,
      }}
      testID="enable-groups-toggle"
    >
      <Text style={{
        color: labelColor || Colors.themeYellow,
        fontSize: labelFontSize,
        fontWeight: labelFontWeight as any,
        ...(useTextShadow ? {
          textShadowColor: Colors.black,
          textShadowOffset: textShadowStrong ? { width: 2, height: 2 } : { width: 1, height: 1 },
          textShadowRadius: textShadowStrong ? 4 : 2,
        } : {}),
      }}>
        Create player groups
      </Text>
      <Switch
        value={false}
        onValueChange={handleToggle}
        trackColor={{ false: Colors.grayDark, true: Colors.themeGreen }}
        thumbColor={'#f4e4bc'}
        style={switchScale !== 1 ? { transform: [{ scale: switchScale }] } : undefined}
        testID="enable-groups-switch"
      />
    </TouchableOpacity>
  );
}
