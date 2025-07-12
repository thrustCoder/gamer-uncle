import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, Animated, Easing, Image } from 'react-native';
import Svg, { G, Path, Text as SvgText, Circle } from 'react-native-svg';
import { turnSelectorStyles as styles } from '../styles/turnSelectorStyles';
import { Colors } from '../styles/colors';
import { Audio } from 'expo-av';

interface Props {
  playerNames: string[];
  onSpinEnd: (winnerIndex: number) => void;
}

const SpinningWheel: React.FC<Props> = ({ playerNames, onSpinEnd }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const currentRotation = useRef(0);

  const spinWheel = async () => {
    const winnerIndex = Math.floor(Math.random() * playerNames.length);
    const segmentAngle = 360 / playerNames.length;
    const rotations = 5;
    
    // Calculate final rotation to position winner at top (under marker)
    const targetAngle = 270 - winnerIndex * segmentAngle - segmentAngle / 2;
    const finalRotation = currentRotation.current + (360 * rotations) + targetAngle;
    
    // Reset spinAnim value to current rotation before starting new animation
    spinAnim.setValue(currentRotation.current);
    currentRotation.current = finalRotation;

    try {
      const sound = new Audio.Sound();
      await sound.loadAsync(require('../assets/sounds/win-fanfare.mp3'));
      await sound.playAsync();
    } catch (e) {
      console.warn('Sound playback error:', e);
    }

    Animated.timing(spinAnim, {
      toValue: finalRotation,
      duration: 3000,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start(() => {
      onSpinEnd(winnerIndex);
    });
  };

  const interpolatedRotate = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const colors = [Colors.wheelRed, Colors.wheelGray, Colors.wheelGreen, Colors.wheelLightGray, Colors.themePurple, Colors.wheelOrange];

  return (
    <View style={{ alignItems: 'center', marginVertical: 20 }}>
      <View style={{ position: 'absolute', top: -50, zIndex: 1 }}>
        <Image 
          source={require('../assets/images/turn_marker.png')} 
          style={{ width: 120, height: 120, resizeMode: 'contain' }} 
        />
      </View>
      <TouchableOpacity onPress={spinWheel} activeOpacity={0.9}>
        <Animated.View style={{ transform: [{ rotate: interpolatedRotate }], width: '100%', aspectRatio: 1 }}>
          <Svg height="100%" width="100%" viewBox="0 0 380 380">
            <G>
              {/* Outer black rim - thinner */}
              <Circle
                cx="190"
                cy="190"
                r="180"
                fill="transparent"
                stroke={Colors.black}
                strokeWidth={10}
              />
              
              {playerNames.map((name, index) => {
                const startAngle = (360 / playerNames.length) * index;
                const endAngle = startAngle + (360 / playerNames.length);
                const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                const x1 = 190 + 180 * Math.cos((Math.PI * startAngle) / 180);
                const y1 = 190 + 180 * Math.sin((Math.PI * startAngle) / 180);
                const x2 = 190 + 180 * Math.cos((Math.PI * endAngle) / 180);
                const y2 = 190 + 180 * Math.sin((Math.PI * endAngle) / 180);
                const d = `M190,190 L${x1},${y1} A180,180 0 ${largeArc},1 ${x2},${y2} z`;

                // Calculate text position
                const labelAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
                const labelRadius = 130;
                const textX = 190 + labelRadius * Math.cos(labelAngle);
                const textY = 190 + labelRadius * Math.sin(labelAngle);

                return (
                  <G key={index}>
                    <Path d={d} fill={colors[index % colors.length]} stroke={Colors.white} strokeWidth={2} />
                    <SvgText
                      fill={Colors.white}
                      fontSize="18"
                      fontWeight="bold"
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      alignmentBaseline="middle">
                      {name}
                    </SvgText>
                  </G>
                );
              })}
              
              {/* Center circle - reduced by half */}
              <Circle
                cx="190"
                cy="190"
                r="10"
                fill={Colors.textDark}
                stroke={Colors.white}
                strokeWidth={2}
              />
            </G>
          </Svg>
        </Animated.View>
      </TouchableOpacity>

      <View style={{ marginTop: 15 }}>
        <Text style={{ 
          color: Colors.white, 
          fontWeight: 'bold', 
          fontSize: 28, 
          textShadowColor: Colors.black, 
          textShadowOffset: { width: 2, height: 2 }, 
          textShadowRadius: 4 
        }}>
          Tap wheel to spin!
        </Text>
      </View>
    </View>
  );
};

export default SpinningWheel;