import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Image,
  Alert,
  PanResponder,
  Animated,
  Switch,
} from 'react-native';
import { chatStyles as styles } from '../styles/chatStyles';
import { chatVoiceStyles as voiceStyles } from '../styles/chatVoiceStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { getRecommendations } from '../services/ApiClient';
import { useNavigation } from '@react-navigation/native';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { useFoundryVoiceSession } from '../hooks/useFoundryVoiceSession';
import { EnvironmentDetection } from '../utils/environmentDetection';
import { PermissionChecker, PermissionStatus } from '../utils/permissionChecker';
import { debugLogger } from '../utils/debugLogger';

// Generate a unique user ID that persists for the session
const generateUserId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Typing indicator component
const TypingIndicator = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View 
      style={styles.systemBubble} 
      testID="typing-indicator"
      {...(Platform.OS === 'web' && { 'data-testid': 'typing-indicator' })}
    >
      <Text style={styles.bubbleText}>🤔{dots}</Text>
    </View>
  );
};

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: '1', type: 'system', text: 'Hi there! 👋 Got a board game question? \n\nWhether you\'re looking for the perfect game, need help with tricky rules 📋, or just some strategy advice - I\'m here to help! 🎲' }
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId] = useState(generateUserId()); // Generate once per session
  const [isLoading, setIsLoading] = useState(false);
  const [showVoiceInstructions, setShowVoiceInstructions] = useState(true);
  const [useFoundryVoice, setUseFoundryVoice] = useState(true); // Toggle for Foundry Live Voice
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    microphone: 'undetermined',
    camera: 'undetermined'
  });
  
  // New UX states - tap-to-start/tap-to-stop pattern
  const [voiceUXMode, setVoiceUXMode] = useState<'default' | 'recording-mode' | 'active-recording' | 'processing'>('default');
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null); // Add this ref
  const navigation = useNavigation();

  // Legacy voice session hook
  const legacyVoiceSession = useVoiceSession((voiceResponse) => {
    // Handle voice response by adding it to chat messages
    if (voiceResponse.responseText) {
      const messageType = voiceResponse.isUserMessage ? 'user' : 'system';
      const newMessage = {
        id: Date.now().toString(),
        type: messageType,
        text: voiceResponse.responseText
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Update conversation ID if provided (only for system responses)
      if (!voiceResponse.isUserMessage && voiceResponse.threadId) {
        setConversationId(voiceResponse.threadId);
      }
      
      // Return to default mode after receiving AI response
      if (!voiceResponse.isUserMessage) {
        console.log('🔄 [CHAT] Received AI response - returning to default mode');
        setVoiceUXMode('default');
      }
    }
  });

  // Foundry voice session hook
  const foundryVoiceSession = useFoundryVoiceSession({
    onVoiceResponse: (voiceResponse) => {
      // Handle voice response by adding it to chat messages
      if (voiceResponse.responseText) {
        const messageType = voiceResponse.isUserMessage ? 'user' : 'system';
        const newMessage = {
          id: Date.now().toString(),
          type: messageType,
          text: voiceResponse.responseText
        };
        setMessages(prev => [...prev, newMessage]);
        
        // Update conversation ID if provided (only for system responses)
        if (!voiceResponse.isUserMessage && voiceResponse.threadId) {
          setConversationId(voiceResponse.threadId);
        }
        
        // Return to default mode after receiving AI response
        if (!voiceResponse.isUserMessage) {
          console.log('🔄 [CHAT] Received AI response - returning to default mode');
          setVoiceUXMode('default');
        }
      }
    }
  });

  // Use the appropriate voice session based on toggle
  const foundrySession = foundryVoiceSession;
  const legacySession = legacyVoiceSession;
  
  // Extract properties based on voice type
  const isVoiceActive = useFoundryVoice ? foundrySession.isActive : legacySession.isActive;
  const isVoiceConnecting = useFoundryVoice ? foundrySession.isConnecting : legacySession.isConnecting;
  const isRecording = useFoundryVoice ? foundrySession.isRecording : legacySession.isRecording;
  const voiceError = useFoundryVoice ? foundrySession.error : legacySession.error;
  const isVoiceSupported = useFoundryVoice ? foundrySession.isSupported : legacySession.isSupported;
  
  // Voice session methods
  const startVoiceSession = useFoundryVoice ? foundrySession.startVoiceSession : legacySession.startVoiceSession;
  const stopVoiceSession = useFoundryVoice ? foundrySession.stopVoiceSession : legacySession.stopVoiceSession;
  const clearVoiceError = useFoundryVoice ? foundrySession.clearError : legacySession.clearError;
  const setRecording = useFoundryVoice ? foundrySession.setRecording : legacySession.setRecording;

  // Animation for mic button
  const micScale = useRef(new Animated.Value(1)).current;
  
  // Pulsating animation for recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

    // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (flatListRef.current) {
      // Use a longer timeout to ensure the message is rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [messages]);

  // Check permissions on mount
  useEffect(() => {
    const checkPerms = async () => {
      try {
        const status = await PermissionChecker.checkPermissions();
        setPermissionStatus(status);
        debugLogger.log('Permission status on mount:', status);
      } catch (error) {
        debugLogger.error('Failed to check permissions:', error);
      }
    };
    checkPerms();
  }, []);

  // Hide voice instructions after first use or timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVoiceInstructions(false);
    }, 10000); // Hide after 10 seconds

    return () => clearTimeout(timer);
  }, []);

  // Pulsating animation effect for active recording and processing
  useEffect(() => {
    if (voiceUXMode === 'active-recording' || voiceUXMode === 'processing') {
      const duration = voiceUXMode === 'processing' ? 1200 : 800; // Slower pulse for processing
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceUXMode, pulseAnim]);

  // Auto-return to default mode when voice session becomes inactive
  useEffect(() => {
    if (voiceUXMode !== 'default' && !isVoiceActive && !isVoiceConnecting) {
      console.log('🔄 [CHAT] Voice session ended - returning to default mode');
      setVoiceUXMode('default');
    }
  }, [isVoiceActive, isVoiceConnecting, voiceUXMode]);

  // Processing timeout - return to default if no AI response within 15 seconds
  useEffect(() => {
    if (voiceUXMode === 'processing') {
      console.log('⏳ [CHAT] Starting 15-second processing timeout');
      processingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ [CHAT] Processing timeout reached - returning to default mode');
        setVoiceUXMode('default');
      }, 15000); // 15 second timeout
    } else {
      // Clear timeout if we exit processing mode
      if (processingTimeoutRef.current) {
        console.log('🛑 [CHAT] Clearing processing timeout');
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    }

    // Cleanup timeout on component unmount
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    };
  }, [voiceUXMode]);

  // Show voice errors to user
  useEffect(() => {
    if (voiceError) {
      Alert.alert(
        'Voice Error',
        voiceError,
        [
          { 
            text: 'OK', 
            onPress: () => clearVoiceError() 
          }
        ]
      );
    }
  }, [voiceError, clearVoiceError]);

  // Voice session handlers
  const handleStartVoice = async () => {
    try {
      // Check permissions first
      const permStatus = await PermissionChecker.checkPermissions();
      setPermissionStatus(permStatus);
      
      // Request permissions if not granted
      if (permStatus.microphone !== 'granted') {
        const requested = await PermissionChecker.requestMicrophonePermission();
        if (!requested) {
          Alert.alert("Permission Required", "Microphone permission is required for voice chat.");
          return;
        }
        
        // Update permission status after request
        const newStatus = await PermissionChecker.checkPermissions();
        setPermissionStatus(newStatus);
      }
      
      // Start appropriate voice session
      if (useFoundryVoice) {
        await foundryVoiceSession.startVoiceSession({
          query: "Start voice conversation",
          conversationId: conversationId || undefined,
          userId: userId,
        });
      } else {
        await legacyVoiceSession.startVoiceSession({
          Query: "Start voice conversation",
          ConversationId: conversationId || undefined,
          UserId: userId,
        });
      }
      setShowVoiceInstructions(false);
    } catch (error) {
      console.error('Failed to start voice session:', error);
      Alert.alert(
        'Voice Session Failed',
        'Failed to start voice session. Please check your microphone permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleStopVoice = async () => {
    try {
      if (useFoundryVoice) {
        await foundryVoiceSession.stopVoiceSession();
      } else {
        await legacyVoiceSession.stopVoiceSession();
      }
    } catch (error) {
      console.error('Failed to stop voice session:', error);
    }
  };

  // Press and hold state management - UPDATED CODE v2
  // New tap-to-start/tap-to-stop voice functionality
  const handleMicButtonPress = async () => {
    console.log('� [CHAT] Mic button pressed - Current UX mode:', voiceUXMode);
    console.log('🎤 [CHAT] Current voice state:', { isVoiceActive, isRecording, isVoiceConnecting, useFoundryVoice });
    
    // Animate button press
    Animated.sequence([
      Animated.spring(micScale, {
        toValue: 1.1,
        useNativeDriver: true,
      }),
      Animated.spring(micScale, {
        toValue: 1,
        useNativeDriver: true,
      })
    ]).start();
    
    switch (voiceUXMode) {
      case 'default':
        // First tap: Enter recording mode (start voice session)
        console.log('🎤 [CHAT] Default mode - entering recording mode');
        setVoiceUXMode('recording-mode');
        await handleStartVoice();
        break;
        
      case 'recording-mode':
        // Second tap: Start recording
        console.log('🎤 [CHAT] Recording mode - starting active recording');
        setVoiceUXMode('active-recording');
        if (useFoundryVoice) {
          foundryVoiceSession.setRecording(true);
        } else {
          legacyVoiceSession.setRecording(true);
        }
        break;
        
      case 'active-recording':
        // Third tap: Stop recording and go to processing state
        console.log('🎤 [CHAT] Active recording - stopping recording and entering processing mode');
        setVoiceUXMode('processing');
        if (useFoundryVoice) {
          foundryVoiceSession.setRecording(false);
        } else {
          legacyVoiceSession.setRecording(false);
        }
        break;
        
      case 'processing':
        // During processing, ignore taps
        console.log('🎤 [CHAT] Processing mode - ignoring tap, waiting for AI response');
        break;
    }
  };

  // Get microphone button style based on new UX states
  const getMicButtonStyle = () => {
    if (!isVoiceSupported) {
      return [voiceStyles.micButton, voiceStyles.micButtonDisabled];
    }
    
    // Red state: Active recording
    if (voiceUXMode === 'active-recording') {
      console.log('🔴 [CHAT] Button RED - Active recording mode');
      return [voiceStyles.micButton, voiceStyles.micButtonActive];
    }
    
    // Orange state: Processing (waiting for AI response)
    if (voiceUXMode === 'processing') {
      console.log('🟠 [CHAT] Button ORANGE - Processing AI response');
      return [voiceStyles.micButton, voiceStyles.micButtonConnecting];
    }
    
    // Green state: Recording mode (ready to record)
    if (voiceUXMode === 'recording-mode') {
      console.log('🟢 [CHAT] Button GREEN - Recording mode (ready)');
      return [voiceStyles.micButton, voiceStyles.micButtonReady];
    }
    
    if (isVoiceConnecting) {
      return [voiceStyles.micButton, voiceStyles.micButtonConnecting];
    }
    
    // Add simulator styling in development
    if (EnvironmentDetection.shouldUseMockVoice()) {
      return [voiceStyles.micButton, voiceStyles.micButtonSimulator];
    }
    
    return voiceStyles.micButton;
  };

  // Debug effect to log component render state
  useEffect(() => {
    console.log('🔍 [CHAT-RENDER] Component rendered with voice state:', {
      isVoiceActive,
      isRecording,
      isVoiceConnecting,
      useFoundryVoice,
      isVoiceSupported,
      voiceUXMode
    });
  }, [isVoiceActive, isRecording, isVoiceConnecting, useFoundryVoice, isVoiceSupported, voiceUXMode]);

  // Get voice status text for new UX pattern
  const getVoiceStatusText = () => {
    if (voiceUXMode === 'active-recording') return 'Tap the mic to stop';
    if (voiceUXMode === 'processing') return 'Processing your request...';
    if (voiceUXMode === 'recording-mode') return 'Tap the mic to record';
    if (isVoiceConnecting) return 'Connecting to voice service...';
    if (voiceError) return voiceError;
    return '';
  };

  // Get voice status icon
  const getVoiceStatusIcon = () => {
    if (isRecording) return '🔴';
    if (isVoiceConnecting) return '🔄';
    if (isVoiceActive) return '🎤';
    if (voiceError) return '⚠️';
    return '';
  };

  // Render simulator banner for development
  const renderSimulatorBanner = () => {
    if (!EnvironmentDetection.shouldUseMockVoice()) return null;
    
    return (
      <View style={voiceStyles.simulatorBanner}>
        <Text style={voiceStyles.simulatorText}>
          🔧 Simulator Mode - Voice UI Testing (Mock Data)
        </Text>
      </View>
    );
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    const userMessageObj = { 
      id: Date.now().toString(), 
      type: 'user', 
      text: userMessage 
    };
    
    setMessages(prev => [...prev, userMessageObj]);
    
    // More aggressive input clearing for button press
    setInput('');
    textInputRef.current?.clear(); // Add this line
    textInputRef.current?.blur();
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
    
    setIsLoading(true);

    // Add typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: typingId, type: 'typing', text: '' }]);

    try {
      // FIX: Use PascalCase keys to match backend
      const response = await getRecommendations({
        Query: userMessage,
        UserId: userId,
        ConversationId: conversationId
      });

      setMessages(prev => prev.filter(msg => msg.id !== typingId));

      if (response.threadId) {
        setConversationId(response.threadId);
      }

      if (response.responseText) {
        const systemMessage = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          text: response.responseText
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      setMessages(prev => prev.filter(msg => msg.id !== typingId));
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        text: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: any) => {
    if (event.nativeEvent.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'typing') {
      return <TypingIndicator />;
    }
    
    return (
      <View 
        style={item.type === 'user' ? styles.userBubble : styles.systemBubble}
        testID={item.type === 'user' ? 'user-message' : 'system-message'}
        {...(Platform.OS === 'web' && { 
          'data-testid': item.type === 'user' ? 'user-message' : 'system-message' 
        })}
      >
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ImageBackground
        source={require('../assets/images/tool_background.png')}
        style={styles.background}
        resizeMode="repeat"
      >
        <BackButton onPress={() => {
          setConversationId(null);
          navigation.goBack(); // <-- Add this line to actually go back
        }} />

        {/* Simulator Mode Banner */}
        {renderSimulatorBanner()}

        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={require('../assets/images/uncle_avatar.png')} style={styles.avatar} />
          </View>

          {/* Voice status indicator - only show when voice is active or there's an error */}
          {(isVoiceActive || voiceError) && (
            <View style={voiceStyles.voiceStatusContainer}>
              <Text style={voiceStyles.voiceStatusText}>
                {getVoiceStatusIcon()} {getVoiceStatusText()}
              </Text>
              {isVoiceActive && (
                <TouchableOpacity 
                  style={voiceStyles.inlineStopButton}
                  onPress={handleStopVoice}
                >
                  <Text style={voiceStyles.inlineStopButtonText}>Stop</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* This wrapper must have flex: 1 */}
          <View style={styles.messagesWrapper}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="always"
              testID="message-container"
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
            />
          </View>

          {/* Foundry Voice Toggle - Positioned above input bar */}
          <View style={voiceStyles.toggleContainer}>
            <Text style={voiceStyles.toggleLabel}>
              {useFoundryVoice ? '🎯 Foundry Live Voice' : '🎙️ Legacy Voice'}
            </Text>
            <Switch
              value={useFoundryVoice}
              onValueChange={setUseFoundryVoice}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={useFoundryVoice ? '#fff' : '#f4f3f4'}
              testID="foundry-voice-toggle"
              {...(Platform.OS === 'web' && { 'data-testid': 'foundry-voice-toggle' })}
            />
          </View>

          <View style={styles.inputBar}>
            {/* Conditionally render text input and send button - hide in recording modes */}
            {voiceUXMode === 'default' && (
              <>
                <TextInput
                  ref={textInputRef}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message"
                  placeholderTextColor={Colors.grayPlaceholder}
                  style={styles.input}
                  editable={!isLoading}
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  testID="chat-input"
                  {...(Platform.OS === 'web' && { 'data-testid': 'chat-input' })}
                />
              </>
            )}
            
            {/* Voice status text in recording modes */}
            {voiceUXMode !== 'default' && (
              <View style={voiceStyles.voiceInstructionContainer}>
                <Text style={voiceStyles.voiceInstructionText}>
                  {getVoiceStatusText()}
                </Text>
                {(voiceUXMode === 'active-recording' || voiceUXMode === 'processing') && (
                  <Animated.View 
                    style={[
                      voiceUXMode === 'active-recording' ? voiceStyles.pulsingIndicator : voiceStyles.processingIndicator,
                      { transform: [{ scale: pulseAnim }] }
                    ]} 
                  />
                )}
              </View>
            )}
            
            {/* Voice Controls - Always show mic button */}
            <View style={voiceStyles.voiceContainer}>
              <Animated.View 
                style={[
                  { transform: [{ scale: micScale }] }
                ]}
              >
                <TouchableOpacity
                  style={getMicButtonStyle()}
                  activeOpacity={0.8}
                  onPress={handleMicButtonPress}
                  testID="mic-button"
                  {...(Platform.OS === 'web' && { 'data-testid': 'mic-button' })}
                >
                  <Text style={voiceStyles.micIcon}>🎤</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Send button - only show in default mode */}
            {voiceUXMode === 'default' && (
              <TouchableOpacity 
                onPress={handleSend} 
                style={[styles.sendButton, isLoading && { opacity: 0.6 }]}
                disabled={isLoading}
                testID="send-button"
                {...(Platform.OS === 'web' && { 'data-testid': 'send-button' })}
              >
                <Text style={styles.sendText}>{isLoading ? '...' : '➤'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Voice Instructions Overlay - only show in default mode */}
          {showVoiceInstructions && isVoiceSupported && voiceUXMode === 'default' && (
            <View style={voiceStyles.holdInstructionOverlay}>
              <Text style={voiceStyles.holdInstructionText}>
                Tap microphone to connect
              </Text>
            </View>
          )}

        </View>

      </ImageBackground>
    </KeyboardAvoidingView>
  );
}