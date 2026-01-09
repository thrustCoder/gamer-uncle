import React from 'react';
import { View, Image, TouchableOpacity, ImageBackground, ScrollView, Text, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { landingStyles as styles } from '../styles/landingStyles';
import Constants from 'expo-constants';

export default function LandingScreen() {
  const navigation = useNavigation<any>();

  return (
    <ImageBackground
      source={require('../assets/images/tool_background.png')}
      style={styles.background}
      resizeMode="repeat"
    >
      <View style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <TouchableOpacity 
            onPress={() => navigation.navigate('Chat')}
            style={{ width: '100%', marginHorizontal: 0, paddingHorizontal: 0 }}
            testID="uncle-header"
            {...(Platform.OS === 'web' && { 'data-testid': 'uncle-header' })}
          >
            <Image
              source={require('../assets/images/uncle_header.png')}
              style={styles.topCard}
              resizeMode="cover"
            />
          </TouchableOpacity>

          <View style={styles.grid}>
            <TouchableOpacity 
              style={styles.iconButtonTurn} 
              onPress={() => navigation.navigate('Turn')}
              testID="turn-button"
              {...(Platform.OS === 'web' && { 'data-testid': 'turn-button' })}
            >
              <Image source={require('../assets/images/turn_icon.png')} style={styles.iconFull} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconButtonTeam} 
              onPress={() => navigation.navigate('Team')}
              testID="team-button"
              {...(Platform.OS === 'web' && { 'data-testid': 'team-button' })}
            >
              <Image source={require('../assets/images/team_icon.png')} style={styles.iconFull} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconButtonDice} 
              onPress={() => navigation.navigate('Dice')}
              testID="dice-button"
              {...(Platform.OS === 'web' && { 'data-testid': 'dice-button' })}
            >
              <Image source={require('../assets/images/dice_icon.png')} style={styles.iconFull} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconButtonTimer} 
              onPress={() => navigation.navigate('Timer')}
              testID="timer-button"
              {...(Platform.OS === 'web' && { 'data-testid': 'timer-button' })}
            >
              <Image source={require('../assets/images/timer_icon.png')} style={styles.iconFull} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Text style={styles.versionText}>
          App Version: {Constants.expoConfig?.version || (Constants.manifest as any)?.version || '2.2.10'}
        </Text>
        <Text style={styles.aiModelText}>AI Model: OpenAI GPT</Text>
      </View>
    </ImageBackground>
  );
}