import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  FlatList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';
import { teamRandomizerStyles as styles } from '../styles/teamRandomizerStyles';
import BackButton from '../components/BackButton';

const MAX_PLAYERS = 10;

export default function TeamRandomizerScreen() {
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(Array.from({ length: 4 }, (_, i) => `P${i + 1}`));
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<string[][]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const confettiRef = useRef(null);
  const hasRandomizedOnce = useRef(false);

  const handleNameChange = (index: number, name: string) => {
    const updated = [...playerNames];
    updated[index] = name;
    setPlayerNames(updated);
  };

  const randomizeTeams = async () => {
    const names = playerNames.slice(0, playerCount);
    const shuffled = names.sort(() => 0.5 - Math.random());
    const result: string[][] = Array.from({ length: teamCount }, () => []);
    shuffled.forEach((name, i) => {
      result[i % teamCount].push(name);
    });
    setTeams(result);
    setCelebrate(false);
    setTimeout(() => setCelebrate(true), 100);
    if (!hasRandomizedOnce.current && confettiRef.current) {
      hasRandomizedOnce.current = true;
      confettiRef.current.start();
    }
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/fanfare.mp3'));
    await sound.playAsync();
  };

  return (
    <ImageBackground source={require('../assets/images/tool_background.png')} style={styles.background}>
      <BackButton />
      <View style={styles.container}>
        <View style={styles.inlineRow}>
          <Text style={styles.title}>Number of players</Text>
          <Picker
            selectedValue={playerCount}
            style={styles.inlinePicker}
            onValueChange={(itemValue) => {
              setPlayerCount(itemValue);
              setPlayerNames(Array.from({ length: itemValue }, (_, i) => `P${i + 1}`));
              setTeamCount(Math.min(teamCount, Math.floor(itemValue / 2)));
            }}>
            {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
              <Picker.Item label={`${n}`} value={n} key={n} />
            ))}
          </Picker>
        </View>

        {playerCount < 7 && (
          <View style={styles.nameInputs}>
            {playerNames.slice(0, playerCount).map((name, index) => (
              <TextInput
                key={index}
                style={[styles.nameInput, playerCount <= 4 && styles.nameInputWide]}
                value={name}
                onChangeText={(text) => handleNameChange(index, text)}
              />
            ))}
          </View>
        )}

        <View style={styles.inlineRow}>
          <Text style={styles.title}>Number of teams</Text>
          <Picker
            selectedValue={teamCount}
            style={styles.inlinePicker}
            onValueChange={(itemValue) => setTeamCount(itemValue)}>
            {Array.from({ length: Math.floor(playerCount / 2) - 1 }, (_, i) => i + 2).map((n) => (
              <Picker.Item label={`${n}`} value={n} key={n} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity style={[styles.randomizeButton, { width: '98%', marginHorizontal: '1%' }]} onPress={randomizeTeams}>
          <Text style={styles.randomizeText}>RANDOMIZE</Text>
        </TouchableOpacity>

        <View style={styles.teamsContainer}>
          {teams.map((team, idx) => (
            <View key={idx} style={[styles.teamCard, idx % 2 === 0 ? styles.cardLeft : styles.cardRight]}>
              <View style={styles.pinDot} />
              <Text style={[styles.teamTitle, { marginTop: 10 }]}>TEAM {idx + 1}</Text>
              {team.map((player, i) => (
                <Text key={i} style={styles.playerName}>{player}</Text>
              ))}
            </View>
          ))}
        </View>

        {celebrate && (
          <ConfettiCannon
            count={100}
            origin={{ x: 200, y: 0 }}
            fadeOut
            autoStart
            ref={confettiRef}
          />
        )}
      </View>
    </ImageBackground>
  );
}
