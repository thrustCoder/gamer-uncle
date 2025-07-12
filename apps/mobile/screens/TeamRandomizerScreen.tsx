import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';
import { teamRandomizerStyles as styles } from '../styles/teamRandomizerStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';

const MAX_PLAYERS = 20;

export default function TeamRandomizerScreen() {
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(Array.from({ length: 4 }, (_, i) => `P${i + 1}`));
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<string[][]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const confettiRef = useRef<any>(null);
  const hasRandomizedOnce = useRef(false);

  const handleNameChange = (index: number, name: string) => {
    const updated = [...playerNames];
    updated[index] = name;
    setPlayerNames(updated);
  };

  const showPlayerCountPicker = () => {
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
            setTeamCount(Math.min(teamCount, Math.floor(newCount / 2)));
          }
        })),
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const showTeamCountPicker = () => {
    const maxTeams = Math.floor(playerCount / 2);
    if (maxTeams < 2) return;
    
    Alert.alert(
      "Select Number of Teams",
      "",
      [
        ...Array.from({ length: maxTeams - 1 }, (_, i) => ({
          text: `${i + 2}`,
          onPress: () => setTeamCount(i + 2)
        })),
        { text: "Cancel", style: "cancel" }
      ]
    );
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
      <View style={styles.container} testID="team-randomizer">
        <View style={styles.inlineRow}>
          <Text style={styles.title}>Number of players</Text>
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
          <TouchableOpacity 
            onPress={showTeamCountPicker}
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
              {teamCount}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.randomizeButton, { width: '98%', marginHorizontal: '1%' }]} onPress={randomizeTeams}>
          <Text style={styles.randomizeText}>RANDOMIZE</Text>
        </TouchableOpacity>

        <ScrollView 
          style={{ marginTop: 30 }} 
          contentContainerStyle={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            justifyContent: 'center' 
          }}
          showsVerticalScrollIndicator={false}
        >
          {teams.map((team, idx) => (
            <View key={idx} style={[styles.teamCard, idx % 2 === 0 ? styles.cardLeft : styles.cardRight]}>
              <View style={styles.pinDot} />
              <Text style={[styles.teamTitle, { marginTop: 10 }]}>TEAM {idx + 1}</Text>
              {team.map((player, i) => (
                <Text key={i} style={styles.playerName}>{player}</Text>
              ))}
            </View>
          ))}
        </ScrollView>

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