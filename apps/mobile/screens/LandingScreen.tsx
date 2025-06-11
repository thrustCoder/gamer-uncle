import React from 'react';
import { View, Image, TouchableOpacity, ImageBackground, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { landingStyles as styles } from '../styles/landingStyles';

export default function LandingScreen() {
  const navigation = useNavigation();

  return (
    <ImageBackground
      source={require('../assets/images/wood_bg.png')}
      style={styles.background}
      resizeMode="repeat"
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity 
          onPress={() => navigation.navigate('Chat')}
          style={{ width: '100%', marginHorizontal: 0, paddingHorizontal: 0 }}
        >
          <Image
            source={require('../assets/images/uncle_header.png')}
            style={styles.topCard}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Dice')}>
            <Image source={require('../assets/images/dice_icon.png')} style={styles.iconFull} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Timer')}>
            <Image source={require('../assets/images/timer_icon.png')} style={styles.iconFull} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Team')}>
            <Image source={require('../assets/images/team_icon.png')} style={styles.iconFull} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Turn')}>
            <Image source={require('../assets/images/turn_icon.png')} style={styles.iconFull} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}