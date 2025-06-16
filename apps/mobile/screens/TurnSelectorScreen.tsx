import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  Animated,
  ImageBackground,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';
import { turnSelectorStyles as styles } from '../styles/turnSelectorStyles';
import SpinningWheel from '../components/SpinningWheel';
import BackButton from '../components/BackButton';

const MAX_PLAYERS = 10;

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

  return (
    <ImageBackground 
      source={require('../assets/images/tool_background.png')} 
      style={styles.container}
      resizeMode="contain"
    >
      <BackButton />

      <View style={[styles.inputBox, { backgroundColor: 'transparent', borderWidth: 0, paddingTop: 40 }]}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 20 
        }}>
          <Text style={[styles.label, { 
            fontSize: 23, 
            color: '#fbe8c9', 
            flex: 1, 
            fontWeight: 'bold',
            textShadowColor: '#000',
            textShadowOffset: { width: 2, height: 2 },
            textShadowRadius: 4,
            marginRight: 20,
            marginLeft: 5,
          }]}>Number of players</Text>
          <View style={{ 
            backgroundColor: 'rgba(139, 69, 19, 0.8)', 
            borderRadius: 12,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            width: 50,
            alignItems: 'center'
          }}>
            <Picker
              selectedValue={playerCount}
              style={{ 
                color: '#5e5a5a', 
                fontSize: 18, 
                height: 50, 
                width: 50
              }}
              itemStyle={{ fontSize: 18 }}
              mode="dropdown"
              dropdownIconColor="#fbe8c9"
              onValueChange={(value) => {
                setPlayerCount(value);
                setPlayerNames(Array.from({ length: value }, (_, i) => `P${i + 1}`));
              }}>
              {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => (
                <Picker.Item key={i} label={`${i + 2}`} value={i + 2} />
              ))}
            </Picker>
          </View>
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
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 10,
                  fontSize: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  width: playerCount <= 2 ? '48%' : 
                        playerCount <= 4 ? '48%' : 
                        '31%', // For 5-6 players, smaller width
                }}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor="#666"
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