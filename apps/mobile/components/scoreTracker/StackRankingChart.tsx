import React, { useMemo } from 'react';
import { View, Text, Animated } from 'react-native';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import type { PlayerRanking } from '../../types/scoreTracker';

interface StackRankingChartProps {
  data: PlayerRanking[];
  maxValue?: number;
  animate?: boolean;
}

/**
 * Generates unique initials for a list of player names
 * If two players have the same first letter, add more letters until unique
 */
function generateUniqueInitials(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const usedInitials = new Set<string>();

  names.forEach((name) => {
    if (!name) {
      result[name] = '?';
      return;
    }

    const cleanName = name.trim().toUpperCase();
    let initials = cleanName[0] || '?';
    let charIndex = 1;

    // Keep adding characters until we have a unique initial
    while (usedInitials.has(initials) && charIndex < cleanName.length) {
      initials = cleanName.substring(0, charIndex + 1);
      charIndex++;
    }

    // If still not unique (very short names or duplicates), add a number
    if (usedInitials.has(initials)) {
      let counter = 2;
      while (usedInitials.has(`${initials}${counter}`)) {
        counter++;
      }
      initials = `${initials}${counter}`;
    }

    usedInitials.add(initials);
    result[name] = initials.substring(0, 3); // Max 3 characters
  });

  return result;
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
        const isLeader = index === 0 && item.total > 0;

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

            {/* Trophy for leader */}
            {isLeader && <Text style={styles.trophyEmoji}>🏆</Text>}
          </View>
        );
      })}
    </View>
  );
}
