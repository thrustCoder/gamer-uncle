import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GameProvider } from './store/GameContext';
import LandingScreen from './screens/LandingScreen';
import ChatScreen from './screens/ChatScreen';
import DiceRollerScreen from './screens/DiceRollerScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GameProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Landing" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Dice" component={DiceRollerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GameProvider>
  );
}