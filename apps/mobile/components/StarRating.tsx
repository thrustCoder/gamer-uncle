import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../styles/colors';

interface StarRatingProps {
  /** Rating value (0-10 scale from BGG, will be converted to 5-star) */
  rating: number;
  /** Maximum rating value (default: 10 for BGG scale) */
  maxRating?: number;
  /** Size of the star icons */
  size?: number;
  /** Color of filled stars */
  filledColor?: string;
  /** Color of empty stars */
  emptyColor?: string;
  /** Whether to show the numeric value */
  showValue?: boolean;
  /** Number of decimal places for the numeric value */
  decimalPlaces?: number;
  /** Optional label to show before the rating */
  label?: string;
}

/**
 * Star rating component that displays a 5-star rating.
 * Converts BGG's 10-point scale to 5-star scale by default.
 */
export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 10,
  size = 16,
  filledColor = Colors.themeYellow,
  emptyColor = Colors.grayDark,
  showValue = true,
  decimalPlaces = 1,
  label,
}) => {
  // Convert to 5-star scale
  const normalizedRating = (rating / maxRating) * 5;
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating - fullStars >= 0.25 && normalizedRating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0) - (normalizedRating - fullStars >= 0.75 ? 1 : 0);
  const extraFullStar = normalizedRating - fullStars >= 0.75 ? 1 : 0;

  const renderStars = () => {
    const stars = [];
    
    // Full stars
    for (let i = 0; i < fullStars + extraFullStar; i++) {
      stars.push(
        <Ionicons 
          key={`full-${i}`} 
          name="star" 
          size={size} 
          color={filledColor} 
        />
      );
    }
    
    // Half star
    if (hasHalfStar) {
      stars.push(
        <Ionicons 
          key="half" 
          name="star-half" 
          size={size} 
          color={filledColor} 
        />
      );
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Ionicons 
          key={`empty-${i}`} 
          name="star-outline" 
          size={size} 
          color={emptyColor} 
        />
      );
    }
    
    return stars;
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { fontSize: size * 0.75 }]}>{label}</Text>}
      <View style={styles.starsContainer}>
        {renderStars()}
      </View>
      {showValue && (
        <Text style={[styles.value, { fontSize: size * 0.875 }]}>
          {normalizedRating.toFixed(decimalPlaces)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: Colors.themeYellow,
    marginRight: 8,
    fontWeight: '500',
  },
  value: {
    color: Colors.themeYellow,
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default StarRating;
