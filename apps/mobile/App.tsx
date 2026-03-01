import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GameProvider } from './store/GameContext';
import { ChatProvider } from './store/ChatContext';
import { TimerProvider } from './store/TimerContext';
import { ScoreTrackerProvider } from './store/ScoreTrackerContext';
import LandingScreen from './screens/LandingScreen';
import ChatScreen from './screens/ChatScreen';
import DiceRollerScreen from './screens/DiceRollerScreen';
import TimerScreen from './screens/TimerScreen';
import TurnSelectorScreen from './screens/TurnSelectorScreen';
import TeamRandomizerScreen from './screens/TeamRandomizerScreen';
import GameSetupScreen from './screens/GameSetupScreen';
import GameSearchScreen from './screens/GameSearchScreen';
import ScoreTrackerScreen from './screens/ScoreTrackerScreen';
import ScoreInputScreen from './screens/ScoreInputScreen';
import ForceUpgradeModal from './components/ForceUpgradeModal';
import TelemetryErrorBoundary from './components/TelemetryErrorBoundary';
import { initTelemetry, AnalyticsEvents } from './services/Telemetry';
import { useAnalytics } from './hooks/useAnalytics';
import { checkAppVersion, VersionCheckResult } from './services/AppConfigService';

const Stack = createStackNavigator();

export default function App() {
  const { onNavigationStateChange } = useAnalytics();
  const [upgradeInfo, setUpgradeInfo] = useState<VersionCheckResult | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    initTelemetry();

    checkAppVersion().then((result) => {
      if (result?.needsUpdate) {
        setUpgradeInfo(result);
        setShowUpgradeModal(true);
      }
    });
  }, []);

  return (
    <GameProvider>
      <ChatProvider>
        <TimerProvider>
          <ScoreTrackerProvider>
            <NavigationContainer onStateChange={onNavigationStateChange}>
              <Stack.Navigator initialRouteName="Landing" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Landing" component={LandingScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="Dice">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_DICE_ROLLER} screenName="Dice Roller">
                      <DiceRollerScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
                <Stack.Screen name="Timer">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_TIMER} screenName="Timer">
                      <TimerScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
                <Stack.Screen name="Turn">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_TURN_SELECTOR} screenName="Turn Selector">
                      <TurnSelectorScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
                <Stack.Screen name="Team">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_TEAM_RANDOMIZER} screenName="Team Randomizer">
                      <TeamRandomizerScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
                <Stack.Screen name="GameSetup">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_GAME_SETUP} screenName="Game Setup">
                      <GameSetupScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
                <Stack.Screen name="GameSearch" component={GameSearchScreen} />
                <Stack.Screen name="ScoreTracker">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_SCORE_TRACKER} screenName="Score Tracker">
                      <ScoreTrackerScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
                <Stack.Screen name="ScoreInput">
                  {() => (
                    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_SCORE_TRACKER} screenName="Score Input">
                      <ScoreInputScreen />
                    </TelemetryErrorBoundary>
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            </NavigationContainer>
            <ForceUpgradeModal
              visible={showUpgradeModal}
              message={upgradeInfo?.message}
              upgradeUrl={upgradeInfo?.upgradeUrl}
              forceUpgrade={upgradeInfo?.forceUpgrade ?? false}
              onDismiss={() => setShowUpgradeModal(false)}
            />
          </ScoreTrackerProvider>
        </TimerProvider>
      </ChatProvider>
    </GameProvider>
  );
}