import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { Colors } from '../../styles/colors';
import type { GameInfo } from '../../types/scoreTracker';

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 140; // Total width of both action buttons

interface ScoreTableRowProps {
  label: string;
  scores: Record<string, number>;
  playerNames: string[];
  game?: GameInfo;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ScoreTableRow({
  label,
  scores,
  playerNames,
  game,
  onEdit,
  onDelete,
}: ScoreTableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal gestures
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        // Stop any ongoing animation
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new position
        const newValue = isOpen.current
          ? -ACTION_WIDTH + gestureState.dx
          : gestureState.dx;
        
        // Clamp the value
        const clampedValue = Math.max(-ACTION_WIDTH, Math.min(0, newValue));
        translateX.setValue(clampedValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = gestureState.dx < -SWIPE_THRESHOLD || 
          (isOpen.current && gestureState.dx > -SWIPE_THRESHOLD && gestureState.dx < SWIPE_THRESHOLD);
        
        if (shouldOpen && !isOpen.current) {
          // Open
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
          isOpen.current = true;
        } else if (!shouldOpen || gestureState.dx > SWIPE_THRESHOLD) {
          // Close
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  const closeRow = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
    isOpen.current = false;
  };

  const handleEdit = () => {
    closeRow();
    onEdit();
  };

  const handleDelete = () => {
    closeRow();
    onDelete();
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action buttons (revealed on swipe) */}
      <View
        style={[
          styles.swipeActions,
          {
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: ACTION_WIDTH,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.swipeActionButton, styles.swipeActionEdit]}
          onPress={handleEdit}
        >
          <Text style={styles.swipeActionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeActionButton, styles.swipeActionDelete]}
          onPress={handleDelete}
        >
          <Text style={styles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Main row content (swipeable) */}
      <Animated.View
        style={[
          styles.tableRow,
          {
            transform: [{ translateX }],
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* First column - label or game */}
        {game ? (
          <View style={styles.gameCell}>
            {game.thumbnailUrl ? (
              <Image
                source={{ uri: game.thumbnailUrl }}
                style={styles.gameCellThumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.gameCellThumbnail, { backgroundColor: Colors.grayPlaceholder, alignItems: 'center', justifyContent: 'center' }]}>
                <MaterialCommunityIcons name="dice-multiple" size={16} color={Colors.grayDark} />
              </View>
            )}
            <Text style={styles.gameCellName} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : (
          <Text style={[styles.tableCell, styles.tableCellFirst]}>{label}</Text>
        )}

        {/* Score columns */}
        {playerNames.map((playerName, index) => (
          <Text key={index} style={[styles.tableCell, { flex: 1 }]}>
            {scores[playerName] ?? 0}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}
