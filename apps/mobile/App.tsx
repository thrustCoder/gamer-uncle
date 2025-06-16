import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GameProvider } from './store/GameContext';
import LandingScreen from './screens/LandingScreen';
import ChatScreen from './screens/ChatScreen';
import DiceRollerScreen from './screens/DiceRollerScreen';
import TimerScreen from './screens/TimerScreen';
import TurnSelectorScreen from './screens/TurnSelectorScreen';
import TeamRandomizerScreen from './screens/TeamRandomizerScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GameProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Landing" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Dice" component={DiceRollerScreen} />
          <Stack.Screen name="Timer" component={TimerScreen} />
          <Stack.Screen name="Turn" component={TurnSelectorScreen} />
          <Stack.Screen name="Team" component={TeamRandomizerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GameProvider>
  );
}