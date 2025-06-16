import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
  withDelay,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { diceRollerStyles as styles } from '../styles/diceRollerStyles';
import BackButton from '../components/BackButton';

const { width, height } = Dimensions.get('window');

const diceImages = {
  1: require('../assets/dice/dice1.png'),
  2: require('../assets/dice/dice2.png'),
  3: require('../assets/dice/dice3.png'),
  4: require('../assets/dice/dice4.png'),
  5: require('../assets/dice/dice5.png'),
  6: require('../assets/dice/dice6.png'),
};

export default function DiceRollerScreen() {
  const navigation = useNavigation();
  const [diceCount, setDiceCount] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [diceValues, setDiceValues] = useState([1]);

  const transX = useSharedValue(0);
  const transY = useSharedValue(0);
  const rotate = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: transX.value },
        { translateY: transY.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/roll.mp3')
    );
    await sound.playAsync();

    transX.value = 0;
    transY.value = 0;
    rotate.value = 0;

    transX.value = withRepeat(
      withSequence(
        withTiming(-50, { duration: 150, easing: Easing.linear }),
        withTiming(50, { duration: 150, easing: Easing.linear }),
        withTiming(-30, { duration: 150, easing: Easing.linear }),
        withTiming(30, { duration: 150, easing: Easing.linear }),
        withTiming(0, { duration: 150, easing: Easing.linear })
      ),
      3,
      false
    );

    transY.value = withRepeat(
      withSequence(
        withTiming(-120, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(60, { duration: 300, easing: Easing.inOut(Easing.bounce) }),
        withTiming(0, { duration: 400, easing: Easing.linear })
      ),
      3,
      false
    );

    rotate.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      2,
      false
    );

    // Delay result update by 3000ms to allow animation to play
    setTimeout(() => {
      const newValues = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      setDiceValues(newValues);
      setRolling(false);
    }, 2000);
  };

  return (
    <ImageBackground source={require('../assets/images/tool_background.png')} style={styles.bg}>
      <BackButton onPress={() => navigation.goBack()} />

      <View style={styles.toggleContainer}>
        <TouchableOpacity onPress={() => setDiceCount(1)} style={[styles.toggleBtn, diceCount === 1 && styles.activeToggle]}>
          <Text style={styles.toggleText}>1 Die</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDiceCount(2)} style={[styles.toggleBtn, diceCount === 2 && styles.activeToggle]}>
          <Text style={styles.toggleText}>2 Dice</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.arena} onPress={rollDice} activeOpacity={0.8}>
        <View style={styles.diceRow}>
          {Array.from({ length: diceCount }).map((_, i) => (
            <Animated.Image
              key={i}
              source={diceImages[diceValues[i] || 1]}
              style={[styles.dice, animatedStyle]}
            />
          ))}
        </View>
      </TouchableOpacity>
    </ImageBackground>
  );
}