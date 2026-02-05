import React, { useMemo } from 'react';
import { View, Text, Animated } from 'react-native';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { generateUniqueInitials } from '../../utils/initialsUtils';
import type { PlayerRanking } from '../../types/scoreTracker';

interface StackRankingChartProps {
  data: PlayerRanking[];
  maxValue?: number;
  animate?: boolean;
}

export default function StackRankingChart({
  data,
  maxValue: providedMaxValue,
  animate = true,
}: StackRankingChartProps) {
  // Sort data descending by total
  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.total - a.total),
    [data]
  );

  // Calculate max value for bar scaling
  const maxValue = useMemo(() => {
    if (providedMaxValue !== undefined) return providedMaxValue;
    const max = Math.max(...sortedData.map((d) => d.total), 1);
    return max;
  }, [sortedData, providedMaxValue]);

  // Generate unique initials for all players
  const initials = useMemo(
    () => generateUniqueInitials(sortedData.map((d) => d.player)),
    [sortedData]
  );

  if (sortedData.length === 0) {
    return null;
  }

  return (
    <View style={styles.rankingContainer}>
      {sortedData.map((item, index) => {
        const barWidth = maxValue > 0 ? (item.total / maxValue) * 100 : 0;

        return (
          <View key={item.player} style={styles.rankingRow}>
            {/* Player initials circle */}
            <View style={styles.rankingInitials}>
              <Text style={styles.rankingInitialsText}>
                {initials[item.player]}
              </Text>
            </View>

            {/* Bar container */}
            <View style={styles.rankingBarContainer}>
              <Animated.View
                style={[
                  styles.rankingBar,
                  {
                    width: `${Math.max(barWidth, 15)}%`,
                  },
                ]}
              >
                <Text style={styles.rankingScore}>{item.total}</Text>
              </Animated.View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
