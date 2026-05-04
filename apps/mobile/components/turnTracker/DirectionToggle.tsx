import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { turnTrackerStyles as styles } from '../../styles/turnTrackerStyles';
import type { TurnDirection } from '../../types/turnTracker';

interface DirectionToggleProps {
  value: TurnDirection;
  onChange: (next: TurnDirection) => void;
}

const DirectionToggle: React.FC<DirectionToggleProps> = ({ value, onChange }) => {
  return (
    <View style={styles.toggleRow} testID="direction-toggle">
      <TouchableOpacity
        style={[styles.toggleSegment, value === 'cw' && styles.toggleSegmentActive]}
        onPress={() => onChange('cw')}
        testID="direction-cw"
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'cw' }}
      >
        <Text style={[styles.toggleText, value === 'cw' && styles.toggleTextActive]}>
          ↻ Clockwise
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toggleSegment, value === 'ccw' && styles.toggleSegmentActive]}
        onPress={() => onChange('ccw')}
        testID="direction-ccw"
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'ccw' }}
      >
        <Text style={[styles.toggleText, value === 'ccw' && styles.toggleTextActive]}>
          ↺ Anti-clockwise
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default DirectionToggle;
