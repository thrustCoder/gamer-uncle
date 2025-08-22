import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  Animated,
  ImageBackground,
  Alert,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';
import { turnSelectorStyles as styles } from '../styles/turnSelectorStyles';
import { Colors } from '../styles/colors';
import SpinningWheel from '../components/SpinningWheel';
import BackButton from '../components/BackButton';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';

const MAX_PLAYERS = 20;

export default function TurnSelectorScreen() {
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(Array.from({ length: 4 }, (_, i) => `P${i + 1}`));
  const [winner, setWinner] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const confettiRef = useRef(null);

  const handleNameChange = (index: number, name: string) => {
    const updatedNames = [...playerNames];
    updatedNames[index] = name || `P${index + 1}`;
  setPlayerNames(updatedNames);
  };

  const handleSpin = async (selectedIndex: number) => {
    setWinner(playerNames[selectedIndex]);
    setCelebrate(false); // Reset first
    setTimeout(() => {
      setCelebrate(true); // Then trigger
    }, 100);
  };

  const showPlayerCountPicker = () => {
    const options = Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => `${i + 2} Players`);
    
    Alert.alert(
      "Select Number of Players",
      "",
      [
        ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => ({
          text: `${i + 2}`,
          onPress: () => {
            const newCount = i + 2;
            setPlayerCount(newCount);
            setPlayerNames(Array.from({ length: newCount }, (_, j) => `P${j + 1}`));
            appCache.setPlayerCount(newCount);
          }
        })),
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // hydrate cache on mount
  useEffect(() => {
    (async () => {
      const [pc, names] = await Promise.all([
        appCache.getPlayerCount(4),
        appCache.getPlayers([]),
      ]);
      setPlayerCount(pc);
      if (names.length > 0) {
        const adjusted = Array.from({ length: pc }, (_, i) => names[i] || `P${i + 1}`);
        setPlayerNames(adjusted);
      }
    })();
  }, []);

  useEffect(() => {
    appCache.setPlayerCount(playerCount);
  }, [playerCount]);

  useDebouncedEffect(() => {
    appCache.setPlayers(playerNames);
  }, [playerNames], 400);

  return (
    <ImageBackground 
      source={require('../assets/images/tool_background.png')} 
      style={[styles.container, { flex: 1 }]}
      resizeMode="cover"
    >
      <BackButton />

      <View style={[styles.inputBox, { backgroundColor: 'transparent', borderWidth: 0, paddingTop: 40, marginTop: 40 }]} testID="turn-selector">
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 20 
        }}>
          <Text style={[styles.label, { 
            fontSize: 25, 
            color: Colors.themeYellow, 
            flex: 1, 
            fontWeight: 'bold',
            textShadowColor: Colors.black,
            textShadowOffset: { width: 2, height: 2 },
            textShadowRadius: 4,
            marginRight: 0,
            marginLeft: 20,
          }]}>Number of players</Text>

          <TouchableOpacity 
            onPress={showPlayerCountPicker}
            style={{ 
              backgroundColor: Colors.themeBrownDark, 
              borderRadius: 12,
              shadowColor: Colors.black,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              width: 80,
              height: 50,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: Colors.themeYellow,
            }}
          >
            <Text style={{
              color: Colors.themeYellow,
              fontSize: 18,
              fontWeight: 'bold',
            }}>
              {playerCount}
            </Text>
          </TouchableOpacity>

        </View>

        {playerCount <= 6 && (
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingHorizontal: 5,
          }}>
            {Array.from({ length: playerCount }).map((_, i) => (
              <TextInput
                key={i}
                style={{
                  backgroundColor: Colors.whiteTransparent,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 10,
                  fontSize: 16,
                  shadowColor: Colors.black,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  width: playerCount <= 2 ? '48%' : 
                        playerCount <= 4 ? '48%' : 
                        '31%', // For 5-6 players, smaller width
                }}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor={Colors.grayDark}
                value={playerNames[i] ?? ''}
                onChangeText={(text) => handleNameChange(i, text)}
              />
            ))}
          </View>
        )}

        <SpinningWheel playerNames={playerNames} onSpinEnd={handleSpin} />
      </View>
      {celebrate && (
        <ConfettiCannon
          count={100}
          origin={{ x: -10, y: 0 }}
          autoStart={true}
          fadeOut={true}
          explosionSpeed={350}
          fallSpeed={2500}
          ref={confettiRef}
        />
      )}
    </ImageBackground>
  );
}