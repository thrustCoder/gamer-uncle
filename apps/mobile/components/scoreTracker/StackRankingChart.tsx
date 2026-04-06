import React, { useMemo } from 'react';
import { View, Text, Animated } from 'react-native';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { generateUniqueInitials } from '../../utils/initialsUtils';
import type { PlayerRanking } from '../../types/scoreTracker';

interface StackRankingChartProps {
  data: PlayerRanking[];
  maxValue?: number;
  animate?: boolean;
  /** When true, sort ascending (lowest score at top) for lowest-score-wins games */
  sortAscending?: boolean;
  /** When provided, all players are shown — those without scores get 0 */
  allPlayerNames?: string[];
}

export default function StackRankingChart({
  data,
  maxValue: providedMaxValue,
  animate = true,
  sortAscending = false,
  allPlayerNames,
}: StackRankingChartProps) {
  // Merge allPlayerNames with 0 for any player not already represented
  const mergedData = useMemo(() => {
    if (!allPlayerNames || allPlayerNames.length === 0) return data;
    const existing = new Set(data.map((d) => d.player));
    const extras: PlayerRanking[] = allPlayerNames
      .filter((n) => !existing.has(n))
      .map((n) => ({ player: n, total: 0 }));
    return [...data, ...extras];
  }, [data, allPlayerNames]);
  // Sort mergedData based on sortAscending flag
  const sortedData = useMemo(
    () => [...mergedData].sort((a, b) => sortAscending ? a.total - b.total : b.total - a.total),
    [mergedData, sortAscending]
  );

  // Calculate min/max values for bar scaling (supports negative scores)
  const minValue = useMemo(
    () => Math.min(...sortedData.map((d) => d.total), 0),
    [sortedData]
  );

  const maxValue = useMemo(() => {
    if (providedMaxValue !== undefined) return providedMaxValue;
    const max = Math.max(...sortedData.map((d) => d.total), 1);
    return max;
  }, [sortedData, providedMaxValue]);

  const valueRange = useMemo(
    () => maxValue - minValue,
    [maxValue, minValue]
  );

  // Generate unique initials for all players
  const initials = useMemo(
    () => generateUniqueInitials(sortedData.map((d) => d.player)),
    [sortedData]
  );

  // Determine if any initials are long enough to need pill-shaped badges
  const maxInitialsLen = useMemo(
    () => Math.max(...Object.values(initials).map((v) => v.length), 1),
    [initials]
  );
  const usePillBadge = maxInitialsLen > 3;
  // Uniform pill width based on the longest initials (approx 9px per char + 16px padding)
  const pillWidth = usePillBadge ? maxInitialsLen * 9 + 16 : undefined;

  if (sortedData.length === 0) {
    return null;
  }

  return (
    <View style={styles.rankingContainer}>
      {sortedData.map((item, index) => {
        const barWidth = valueRange > 0 ? ((item.total - minValue) / valueRange) * 100 : 0;

        return (
          <View key={item.player} style={styles.rankingRow}>
            {/* Player initials badge — circle for short, pill for long */}
            <View style={usePillBadge ? [styles.rankingInitialsPill, { width: pillWidth }] : styles.rankingInitials}>
              <Text style={styles.rankingInitialsText} numberOfLines={1}>
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
