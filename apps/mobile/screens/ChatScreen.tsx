import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { chatStyles as styles } from '../styles/chatStyles';
import { chatVoiceStyles as voiceStyles } from '../styles/chatVoiceStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import { getRecommendations } from '../services/ApiClient';
import { useNavigation } from '@react-navigation/native';
import { useVoiceSession } from '../hooks/useVoiceSession';

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
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null); // Add this ref
  const navigation = useNavigation();

  // Voice session hook
  const {
    isActive: isVoiceActive,
    isConnecting: isVoiceConnecting,
    isRecording,
    error: voiceError,
    startVoiceSession,
    stopVoiceSession,
    setRecording,
    clearError: clearVoiceError,
    isSupported: isVoiceSupported,
  } = useVoiceSession();

  // Animation for mic button
  const micScale = useRef(new Animated.Value(1)).current;

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (flatListRef.current) {
      // Use a longer timeout to ensure the message is rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [messages.length]); // Only trigger when message count changes

  // Hide voice instructions after first use or timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVoiceInstructions(false);
    }, 10000); // Hide after 10 seconds

    return () => clearTimeout(timer);
  }, []);

  // Voice session handlers
  const handleStartVoice = async () => {
    if (!isVoiceSupported) {
      Alert.alert(
        'Voice Not Supported',
        'Voice functionality is not supported on this device.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await startVoiceSession({
        Query: "Start voice conversation", // Required query for voice session
        ConversationId: conversationId || undefined,
        UserId: userId, // Include user ID for tracking
      });
      setShowVoiceInstructions(false);
    } catch (error) {
      console.error('Failed to start voice session:', error);
    }
  };

  const handleStopVoice = async () => {
    try {
      await stopVoiceSession();
    } catch (error) {
      console.error('Failed to stop voice session:', error);
    }
  };

  // Pan responder for press-and-hold microphone functionality
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => false,
    
    onPanResponderGrant: () => {
      // Start recording on press
      Animated.spring(micScale, {
        toValue: 1.2,
        useNativeDriver: true,
      }).start();
      
      if (isVoiceActive) {
        setRecording(true);
      } else {
        handleStartVoice();
      }
    },
    
    onPanResponderRelease: () => {
      // Stop recording on release
      Animated.spring(micScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      
      if (isVoiceActive && isRecording) {
        setRecording(false);
      }
    },
    
    onPanResponderTerminate: () => {
      // Stop recording if gesture is terminated
      Animated.spring(micScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      
      if (isVoiceActive && isRecording) {
        setRecording(false);
      }
    },
  });

  // Get microphone button style based on voice state
  const getMicButtonStyle = () => {
    if (!isVoiceSupported) {
      return [voiceStyles.micButton, voiceStyles.micButtonDisabled];
    }
    if (isRecording) {
      return [voiceStyles.micButton, voiceStyles.micButtonActive];
    }
    if (isVoiceConnecting) {
      return [voiceStyles.micButton, voiceStyles.micButtonConnecting];
    }
    return voiceStyles.micButton;
  };

  // Get voice status text
  const getVoiceStatusText = () => {
    if (isRecording) return 'Recording... Release to stop';
    if (isVoiceConnecting) return 'Connecting to voice service...';
    if (isVoiceActive) return 'Voice ready - Hold mic to talk';
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

        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={require('../assets/images/uncle_avatar.png')} style={styles.avatar} />
          </View>

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

          <View style={styles.inputBar}>
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
            
            {/* Voice Controls */}
            {isVoiceSupported && (
              <View style={voiceStyles.voiceContainer}>
                <Animated.View 
                  style={[
                    { transform: [{ scale: micScale }] }
                  ]}
                  {...panResponder.panHandlers}
                >
                  <TouchableOpacity
                    style={getMicButtonStyle()}
                    activeOpacity={0.8}
                    testID="mic-button"
                    {...(Platform.OS === 'web' && { 'data-testid': 'mic-button' })}
                  >
                    <Text style={voiceStyles.micIcon}>🎤</Text>
                    {isRecording && (
                      <View style={voiceStyles.recordingIndicator} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}

            <TouchableOpacity 
              onPress={handleSend} 
              style={[styles.sendButton, isLoading && { opacity: 0.6 }]}
              disabled={isLoading}
              testID="send-button"
              {...(Platform.OS === 'web' && { 'data-testid': 'send-button' })}
            >
              <Text style={styles.sendText}>{isLoading ? '...' : '➤'}</Text>
            </TouchableOpacity>
          </View>

          {/* Voice Status Overlay */}
          {(isVoiceActive || isVoiceConnecting || voiceError) && (
            <View style={[
              voiceStyles.voiceStatusOverlay, 
              voiceError && voiceStyles.voiceError
            ]}>
              <View style={[
                voiceStyles.connectionDot,
                isVoiceActive && voiceStyles.connectionDotConnected,
                isVoiceConnecting && voiceStyles.connectionDotConnecting,
                voiceError && voiceStyles.connectionDotDisconnected,
              ]} />
              <Text style={[
                voiceStyles.voiceStatusText,
                voiceError && voiceStyles.voiceErrorText
              ]}>
                {getVoiceStatusIcon()} {getVoiceStatusText()}
              </Text>
              
              {voiceError && (
                <TouchableOpacity 
                  style={voiceStyles.dismissButton}
                  onPress={clearVoiceError}
                >
                  <Text style={voiceStyles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              )}
              
              {isVoiceActive && (
                <TouchableOpacity 
                  style={voiceStyles.dismissButton}
                  onPress={handleStopVoice}
                >
                  <Text style={voiceStyles.dismissButtonText}>Stop</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Voice Instructions Overlay */}
          {showVoiceInstructions && isVoiceSupported && !isVoiceActive && (
            <View style={voiceStyles.holdInstructionOverlay}>
              <Text style={voiceStyles.holdInstructionText}>
                Hold microphone button to talk with voice
              </Text>
            </View>
          )}

        </View>

      </ImageBackground>
    </KeyboardAvoidingView>
  );
}