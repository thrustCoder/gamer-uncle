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
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { teamRandomizerStyles as styles } from '../styles/teamRandomizerStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';

const MAX_PLAYERS = 20;

export default function TeamRandomizerScreen() {
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(Array.from({ length: 4 }, (_, i) => `P${i + 1}`));
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<string[][]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const hasRandomizedOnce = useRef(false);
  
  // Animation values for celebration
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationBounce = useRef(new Animated.Value(0)).current;

  const handleNameChange = (index: number, name: string) => {
    const updated = [...playerNames];
    updated[index] = name;
  setPlayerNames(updated);
  };

  const startCelebrationAnimation = () => {
    // Reset animation values
    celebrationScale.setValue(0);
    celebrationOpacity.setValue(0);
    celebrationBounce.setValue(0);
    
    setCelebrate(true);
    
    // Start the celebration animation sequence
    Animated.sequence([
      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 3,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(celebrationBounce, {
            toValue: -10,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(celebrationBounce, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      ),
      Animated.timing(celebrationOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCelebrate(false);
    });
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
            appCache.setPlayerCount(newCount);
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
          onPress: () => {
            const val = i + 2;
            setTeamCount(val);
            appCache.setTeamCount(val);
          }
        })),
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const randomizeTeams = async () => {
    // Create array of objects with name and original index
    const playersWithIndex = playerNames.slice(0, playerCount).map((name, index) => ({
      name: name || `P${index + 1}`,
      originalIndex: index
    }));
    const shuffled = playersWithIndex.sort(() => 0.5 - Math.random());
    const result: string[][] = Array.from({ length: teamCount }, () => []);
    shuffled.forEach((player, i) => {
      result[i % teamCount].push(player.name);
    });
    setTeams(result);
    
    // Start celebration animation
    setTimeout(() => startCelebrationAnimation(), 100);
    
    if (!hasRandomizedOnce.current) {
      hasRandomizedOnce.current = true;
    }
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/fanfare.mp3'));
    await sound.playAsync();
  };

  // hydrate cache on mount
  useEffect(() => {
    (async () => {
      const [pc, tc, names] = await Promise.all([
        appCache.getPlayerCount(4),
        appCache.getTeamCount(2),
        appCache.getPlayers([]),
      ]);
      setPlayerCount(pc);
      setTeamCount(tc);
      if (names.length > 0) {
        // ensure length matches playerCount
        const adjusted = Array.from({ length: pc }, (_, i) => names[i] || `P${i + 1}`);
        setPlayerNames(adjusted);
      } else {
        // Only set default names if no cached names exist
        setPlayerNames(Array.from({ length: pc }, (_, i) => `P${i + 1}`));
      }
    })();
  }, []);

  // persist when core counts change
  useEffect(() => {
    appCache.setPlayerCount(playerCount);
  }, [playerCount]);

  useEffect(() => {
    appCache.setTeamCount(teamCount);
  }, [teamCount]);

  useDebouncedEffect(() => {
    appCache.setPlayers(playerNames);
  }, [playerNames], 400);

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
              borderRadius: 7,
              shadowColor: Colors.black,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              width: 48,
              height: 30,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: Colors.themeYellow,
            }}
          >
            <Text style={{
              color: Colors.themeYellow,
              fontSize: 15,
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
                placeholder={`Player ${index + 1}`}
                placeholderTextColor="#999"
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
              borderRadius: 7,
              shadowColor: Colors.black,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              width: 48,
              height: 30,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: Colors.themeYellow,
            }}
          >
            <Text style={{
              color: Colors.themeYellow,
              fontSize: 15,
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
          <Animated.View 
            style={{ 
              position: 'absolute', 
              top: 60, 
              left: 0, 
              right: 0, 
              alignItems: 'center',
              transform: [
                { scale: celebrationScale },
                { translateY: celebrationBounce }
              ],
              opacity: celebrationOpacity,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: Colors.themeGreen, textAlign: 'center' }}>
              🎉 🎊 🎈
            </Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: Colors.themeGreen, marginTop: 5, textAlign: 'center' }}>
              Teams Generated!
            </Text>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: Colors.themeGreen, textAlign: 'center' }}>
              🏆 ⭐ �
            </Text>
          </Animated.View>
        )}
      </View>
    </ImageBackground>
  );
}