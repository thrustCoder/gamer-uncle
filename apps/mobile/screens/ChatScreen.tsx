import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import MarkdownText from '../components/MarkdownText';
import { getRecommendations } from '../services/ApiClient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { EnvironmentDetection } from '../utils/environmentDetection';
import { PermissionChecker, PermissionStatus } from '../utils/permissionChecker';
import { debugLogger } from '../utils/debugLogger';
import { useChat, ChatMessage } from '../store/ChatContext';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';
import { shouldShowRatingPrompt, recordDismissal, recordRated, requestStoreReview } from '../services/ratingPrompt';
import RatingBanner from '../components/RatingBanner';

// Define route params type for Chat screen
type ChatRouteParams = {
  Chat: {
    prefillContext?: {
      gameName: string;
      playerCount: number;
      previousSetupQuery: boolean;
    };
    gameContext?: {
      gameName: string;
      fromGameSearch: boolean;
    };
  };
};

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

// Voice processing indicator component (rotating dots for voice messages)
const VoiceProcessingIndicator = () => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '.';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View 
      style={styles.userBubble} 
      testID="voice-processing-indicator"
      {...(Platform.OS === 'web' && { 'data-testid': 'voice-processing-indicator' })}
    >
      <Text style={styles.bubbleText}>🎤{dots}</Text>
    </View>
  );
};

// System thinking indicator component (rotating dots for AI processing)
const SystemThinkingIndicator = () => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '.';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View 
      style={styles.systemBubble} 
      testID="system-thinking-indicator"
      {...(Platform.OS === 'web' && { 'data-testid': 'system-thinking-indicator' })}
    >
      <Text style={styles.bubbleText}>🤔{dots}</Text>
    </View>
  );
};

// User thinking indicator component (rotating dots for text message processing - matches voice UX)
const UserThinkingIndicator = () => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '.';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View 
      style={styles.userBubble} 
      testID="user-thinking-indicator"
      {...(Platform.OS === 'web' && { 'data-testid': 'user-thinking-indicator' })}
    >
      <Text style={styles.bubbleText}>✏️{dots}</Text>
    </View>
  );
};

export default function ChatScreen() {
  // Get route params for prefill context from GameSetup or GameSearch
  const route = useRoute<RouteProp<ChatRouteParams, 'Chat'>>();
  const prefillContext = route.params?.prefillContext;
  const gameContext = route.params?.gameContext;
  
  // Use ChatContext for persisted state
  const { messages, setMessages, conversationId, setConversationId, clearChat } = useChat();
  const [input, setInput] = useState('');
  const [userId] = useState(generateUserId()); // Generate once per session
  const [isLoading, setIsLoading] = useState(false);
  const [showVoiceInstructions, setShowVoiceInstructions] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    microphone: 'undetermined',
    camera: 'undetermined'
  });

  // Rating prompt state
  const [showRatingBanner, setShowRatingBanner] = useState(false);
  const [sessionMessageCount, setSessionMessageCount] = useState(0);
  const [hasSessionErrors, setHasSessionErrors] = useState(false);
  const ratingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ratingPromptShownRef = useRef(false);
  
  // Track if we've already handled the prefill context (to avoid duplicate messages)
  const prefillHandledRef = useRef(false);
  
  // Track which game context we've already handled (to detect new game navigations)
  const lastHandledGameContextRef = useRef<string | null>(null);
  
  // Store game context from GameSetup to prepend to first user message for AI context
  const gameContextRef = useRef<{ gameName: string; playerCount?: number } | null>(null);
  
  // New UX states - tap-to-start/tap-to-stop pattern with TTS controls
  const [voiceUXMode, setVoiceUXMode] = useState<'default' | 'recording-mode' | 'active-recording' | 'processing' | 'tts-playing' | 'tts-paused'>('default');
  const voiceUXModeRef = useRef(voiceUXMode);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track which message is currently playing TTS (for inline pause/play button)
  const [activeTTSMessageId, setActiveTTSMessageId] = useState<string | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    voiceUXModeRef.current = voiceUXMode;
  }, [voiceUXMode]);
  
  // Clean up stale 'thinking', 'typing', and 'user-thinking' messages on screen load
  // These are transient indicators that should not persist across navigation
  useEffect(() => {
    setMessages(prev => prev.filter(msg => msg.type !== 'thinking' && msg.type !== 'typing' && msg.type !== 'user-thinking'));
  }, []); // Only run once on mount

  // Handle game context from GameSearch screen
  useEffect(() => {
    // Only handle if this is a new game (different from last handled)
    const currentGameName = gameContext?.gameName;
    const isNewGame = gameContext?.fromGameSearch && currentGameName && currentGameName !== lastHandledGameContextRef.current;
    
    if (isNewGame) {
      lastHandledGameContextRef.current = currentGameName;
      trackEvent(AnalyticsEvents.CHAT_CONTEXT_RECEIVED, { source: 'GameSearch', gameName: gameContext.gameName });
      
      // Store game context for AI
      gameContextRef.current = {
        gameName: gameContext.gameName
      };
      
      // Clear previous chat and add contextual system message
      const contextMessage: ChatMessage = {
        id: `context-${Date.now()}`,
        type: 'system',
        text: `What would you like to know about **${gameContext.gameName}**? I can help with rules, strategies, setup, or any other questions! 🎲`
      };
      
      // Replace all messages with context-aware message (clears previous chat)
      setMessages([contextMessage]);
      setConversationId(null); // Start fresh conversation
    }
  }, [gameContext, setMessages, setConversationId]);

  // Handle prefill context from GameSetup screen
  useEffect(() => {
    if (prefillContext?.previousSetupQuery && !prefillHandledRef.current) {
      prefillHandledRef.current = true;
      trackEvent(AnalyticsEvents.CHAT_CONTEXT_RECEIVED, { source: 'GameSetup', gameName: prefillContext.gameName });
      
      // Store game context to prepend to first user message for AI
      gameContextRef.current = {
        gameName: prefillContext.gameName,
        playerCount: prefillContext.playerCount
      };
      
      // Clear previous chat and add contextual system message
      const contextMessage: ChatMessage = {
        id: `context-${Date.now()}`,
        type: 'system',
        text: `What else would you like to know about setting up **${prefillContext.gameName}** for ${prefillContext.playerCount} player${prefillContext.playerCount > 1 ? 's' : ''}? I can help with rules clarification, strategy tips, or anything else about this game! 🎲`
      };
      
      // Replace initial message with context-aware message
      setMessages([contextMessage]);
      setConversationId(null); // Start fresh conversation
    }
  }, [prefillContext]);

  // Check if we're in a thinking/processing state (disable input during this time)
  const isProcessing = useMemo(() => {
    return messages.some(msg => msg.type === 'thinking' || msg.type === 'typing' || msg.type === 'user-thinking');
  }, [messages]);
  
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null); // Add this ref
  const navigation = useNavigation();

  // Auto-stop handler for recording safety (max duration & silence detection)
  const handleRecordingAutoStop = useCallback((reason: 'max-duration' | 'silence') => {
    console.log(`🛑 [CHAT] Recording auto-stopped due to: ${reason}`);
    
    // Transition from active-recording to processing (use ref to avoid stale closure)
    if (voiceUXModeRef.current === 'active-recording') {
      setVoiceUXMode('processing');
    }
    
    // Show a brief notification to the user
    const message = reason === 'max-duration' 
      ? 'Recording stopped (1 minute limit reached)'
      : 'Recording stopped (silence detected)';
    
    // Use a lightweight notification instead of blocking Alert
    console.log(`📢 [CHAT] ${message}`);
  }, []); // Empty deps - uses ref to access current voiceUXMode

  // Recording safety configuration: 1 minute max, 10 seconds silence detection
  const recordingSafetyConfig = useMemo(() => ({
    maxRecordingDurationMs: 60000,  // 1 minute max recording
    silenceThresholdDb: -40,         // Audio level below -40dB is considered silence
    silenceDurationMs: 10000,        // 10 seconds of silence triggers auto-stop
    onAutoStop: handleRecordingAutoStop,
  }), [handleRecordingAutoStop]);

  // Build game context string for voice messages (computed directly, not memoized)
  // This needs to be computed every render so it picks up changes to gameContextRef
  const gameContextString = (gameContextRef.current && !conversationId) 
    ? `[Context: The user was just setting up the board game "${gameContextRef.current.gameName}" for ${gameContextRef.current.playerCount} players and needs more help.]`
    : null;

  // Voice session hook with new audio processing pipeline - pass conversationId and game context
  const voiceSession = useVoiceSession((voiceResponse) => {
    // Handle TTS events for UX mode changes
    if (voiceResponse.eventType === 'tts-start') {
      console.log('🔊 [CHAT] TTS started - switching to tts-playing mode');
      setVoiceUXMode('tts-playing');
      // activeTTSMessageId is set when the system message is added below
      return;
    }
    
    if (voiceResponse.eventType === 'tts-end') {
      console.log('🔊 [CHAT] TTS ended - returning to default mode');
      setVoiceUXMode('default');
      setActiveTTSMessageId(null);
      return;
    }
    
    // Handle thinking indicator (system processing)
    if (voiceResponse.eventType === 'thinking') {
      const thinkingMessage: ChatMessage = {
        id: `thinking-${Date.now()}`,
        type: 'thinking',
        text: '',
        isVoiceMessage: true
      };
      setMessages(prev => [...prev, thinkingMessage]);
      return;
    }
    
    // Handle voice response by adding it to chat messages
    // Special case: empty responseText with transcription event means clear processing indicator
    if (voiceResponse.responseText === '' && voiceResponse.eventType === 'transcription' && voiceResponse.isUserMessage) {
      console.log('🧹 [CHAT] Clearing user processing indicator (empty transcription event)');
      setMessages(prev => prev.filter(
        msg => !(msg.type === 'user' && msg.isVoiceMessage && (msg.text === '🎤...' || msg.text?.startsWith('🎤.')))
      ));
      return;
    }
    
    if (voiceResponse.responseText) {
      const messageType = voiceResponse.isUserMessage ? 'user' : 'system';
      
      // Check if this is a user transcription replacing the processing indicator
      if (voiceResponse.isUserMessage && voiceResponse.responseText !== '🎤...') {
        // Replace the processing indicator (🎤...) or update existing voice user message with the actual transcription
        setMessages(prev => {
          // First, try to find the processing indicator (🎤...)
          const processingMsgIndex = prev.findIndex(
            msg => msg.type === 'user' && msg.isVoiceMessage && (msg.text === '🎤...' || msg.text?.startsWith('🎤.'))
          );
          
          if (processingMsgIndex !== -1) {
            // Replace the processing indicator
            const newMessages = [...prev];
            newMessages[processingMsgIndex] = {
              ...newMessages[processingMsgIndex],
              text: voiceResponse.responseText,
              isVoiceMessage: true
            };
            return newMessages;
          }
          
          // If no processing indicator, check if there's a recent voice user message to update
          // (This handles the case where on-device STT already updated the message)
          const lastVoiceUserMsgIndex = [...prev].reverse().findIndex(
            msg => msg.type === 'user' && msg.isVoiceMessage
          );
          
          if (lastVoiceUserMsgIndex !== -1) {
            // Convert reverse index to forward index
            const actualIndex = prev.length - 1 - lastVoiceUserMsgIndex;
            const existingMsg = prev[actualIndex];
            
            // Only update if the message content is different (avoid no-op updates)
            if (existingMsg.text !== voiceResponse.responseText) {
              const newMessages = [...prev];
              newMessages[actualIndex] = {
                ...existingMsg,
                text: voiceResponse.responseText,
                isVoiceMessage: true
              };
              return newMessages;
            }
            // Same content, no update needed
            return prev;
          }
          
          // No existing voice user message, add a new one
          return [...prev, {
            id: Date.now().toString(),
            type: messageType,
            text: voiceResponse.responseText,
            isVoiceMessage: true
          }];
        });
      } else if (!voiceResponse.isUserMessage) {
        // For AI response or other system messages
        // Check event type to determine how to handle
        const isSimpleNotification = voiceResponse.eventType === 'transcription';
        const isDirectMessage = voiceResponse.eventType === 'direct-message';
        
        const newMessageId = Date.now().toString();
        setMessages(prev => {
          if (isSimpleNotification) {
            // For simple notifications (like transcription updates)
            // Just add the message - don't remove thinking indicators
            return [...prev, {
              id: newMessageId,
              type: 'system',
              text: voiceResponse.responseText,
              isVoiceMessage: true
            }];
          } else if (isDirectMessage) {
            // For direct messages (like "I didn't catch that" - error responses)
            // Remove thinking indicators since this is an error/final response
            const filtered = prev.filter(msg => msg.type !== 'thinking');
            return [...filtered, {
              id: newMessageId,
              type: 'system',
              text: voiceResponse.responseText,
              isVoiceMessage: true
            }];
          } else {
            // For AI responses, remove thinking indicator and add system message
            const filtered = prev.filter(msg => msg.type !== 'thinking');
            // Also remove any orphaned user processing indicators (🎤...) for error responses
            const cleanedFiltered = filtered.filter(
              msg => !(msg.type === 'user' && msg.isVoiceMessage && (msg.text === '🎤...' || msg.text?.startsWith('🎤.')))
            );
            return [...cleanedFiltered, {
              id: newMessageId,
              type: 'system',
              text: voiceResponse.responseText,
              isVoiceMessage: true
            }];
          }
        });
        
        // Track this message for TTS playback controls (only for AI responses, not simple notifications/direct messages)
        if (!isSimpleNotification && !isDirectMessage) {
          setActiveTTSMessageId(newMessageId);
        }
        if (!isSimpleNotification) {
          setActiveTTSMessageId(newMessageId);
        }
        
        // Return to default mode when we receive a response (handles error responses)
        // Only reset if currently in processing mode
        if (voiceUXModeRef.current === 'processing') {
          console.log('🔄 [CHAT] Received system response - returning to default mode');
          setVoiceUXMode('default');
        }
      } else {
        // For processing indicator, just add
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          type: messageType,
          text: voiceResponse.responseText,
          isVoiceMessage: true
        };
        setMessages(prev => [...prev, newMessage]);
      }
      
      // Update conversation ID if provided (only for system responses)
      if (!voiceResponse.isUserMessage && voiceResponse.threadId) {
        setConversationId(voiceResponse.threadId);
        // Clear game context after first voice message is processed (context was already sent with that message)
        if (gameContextRef.current) {
          console.log('🎮 [CHAT] Clearing game context after voice message processed');
          gameContextRef.current = null;
        }
      }
    }
  }, conversationId, recordingSafetyConfig, gameContextString); // Pass conversationId, safety config, and game context
  
  // Extract voice properties
  const { isActive: isVoiceActive, isConnecting: isVoiceConnecting, isRecording, error: voiceError, isSupported: isVoiceSupported, setRecording, stopAudioPlayback, pauseAudioPlayback, resumeAudioPlayback, isAudioPaused, clearError: clearVoiceError, startVoiceSession, stopVoiceSession } = voiceSession;

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

  // Check permissions on mount (check only, don't request - that happens on mic tap)
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

  // ── Rating prompt evaluation ─────────────────────────────────
  // Evaluate after a successful AI response with 2-second delay.
  // Cancels if user starts typing in the meantime.
  useEffect(() => {
    // Only evaluate once per session, and only when we have messages
    if (ratingPromptShownRef.current || sessionMessageCount === 0) return;

    // Look for the last message being a system (AI) response
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.type !== 'system') return;

    // Clear any previous timer
    if (ratingTimerRef.current) {
      clearTimeout(ratingTimerRef.current);
    }

    ratingTimerRef.current = setTimeout(async () => {
      const shouldShow = await shouldShowRatingPrompt(
        sessionMessageCount,
        hasSessionErrors,
      );
      if (shouldShow) {
        ratingPromptShownRef.current = true;
        setShowRatingBanner(true);
        trackEvent(AnalyticsEvents.RATING_PROMPT_SHOWN);
      }
    }, 2000);

    return () => {
      if (ratingTimerRef.current) {
        clearTimeout(ratingTimerRef.current);
        ratingTimerRef.current = null;
      }
    };
  }, [messages, sessionMessageCount, hasSessionErrors]);

  // Cancel rating prompt timer when user starts typing
  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    if (ratingTimerRef.current) {
      clearTimeout(ratingTimerRef.current);
      ratingTimerRef.current = null;
    }
  }, []);

  // Rating banner callbacks
  const handleRatingRate = useCallback(async () => {
    await recordRated();
    await requestStoreReview();
    trackEvent(AnalyticsEvents.RATING_PROMPT_RATED);
    setShowRatingBanner(false);
  }, []);

  const handleRatingDismiss = useCallback(async () => {
    await recordDismissal();
    trackEvent(AnalyticsEvents.RATING_PROMPT_DISMISSED);
    setShowRatingBanner(false);
  }, []);

  // Clean up orphaned processing indicators on mount
  // These can occur if the app was closed/restarted while voice was processing
  useEffect(() => {
    const hasOrphanedIndicators = messages.some(
      msg => msg.text === '🎤...' || msg.text?.startsWith('🎤.')
    );
    
    if (hasOrphanedIndicators) {
      debugLogger.log('Cleaning up orphaned voice processing indicators from chat history');
      setMessages(prev => prev.filter(
        msg => msg.text !== '🎤...' && !msg.text?.startsWith('🎤.')
      ));
    }
  }, []); // Run only on mount

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
      // More prominent pulse for active recording (larger scale, faster)
      const duration = voiceUXMode === 'active-recording' ? 500 : 1000;
      const maxScale = voiceUXMode === 'active-recording' ? 1.25 : 1.15;
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: maxScale,
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
  // Only reset from 'processing' mode, not from 'recording-mode' or 'active-recording'
  useEffect(() => {
    if (voiceUXMode === 'processing' && !isVoiceActive && !isVoiceConnecting) {
      console.log('🔄 [CHAT] Voice session ended - returning to default mode');
      setVoiceUXMode('default');
    }
  }, [isVoiceActive, isVoiceConnecting, voiceUXMode]);

  // Monitor isRecording - if it becomes false while in active-recording mode, reset to default
  // This handles cases where recording fails to start (e.g., permission denied)
  useEffect(() => {
    if (voiceUXMode === 'active-recording' && !isRecording) {
      // Small delay to avoid race conditions during normal recording start/stop
      const timeout = setTimeout(() => {
        // Double-check state hasn't changed
        if (voiceUXModeRef.current === 'active-recording' && !isRecording) {
          console.log('🔄 [CHAT] Recording stopped unexpectedly (possibly permission denied) - returning to default mode');
          setVoiceUXMode('default');
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isRecording, voiceUXMode]);

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

  // Cleanup TTS on component unmount (navigation away)
  useEffect(() => {
    return () => {
      console.log('🧹 [CHAT] Cleaning up - stopping TTS on unmount');
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  // Show voice errors to user and reset UX state
  useEffect(() => {
    if (voiceError) {
      // Reset to default mode when voice error occurs
      console.log('⚠️ [CHAT] Voice error occurred - resetting to default mode');
      setVoiceUXMode('default');
      
      // Clean up any orphaned processing indicators
      setMessages(prev => prev.filter(
        msg => !(msg.type === 'user' && msg.isVoiceMessage && (msg.text === '🎤...' || msg.text?.startsWith('🎤.')))
          && msg.type !== 'thinking'
      ));
      
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
  }, [voiceError, clearVoiceError, setMessages]);

  // Voice session handlers
  const handleStartVoice = async () => {
    try {
      console.log('🎤 [CHAT] handleStartVoice - checking permissions...');
      
      // Check permissions first
      const permStatus = await PermissionChecker.checkPermissions();
      setPermissionStatus(permStatus);
      
      // Request permissions if not granted
      if (permStatus.microphone !== 'granted') {
        console.log('🎤 [CHAT] Microphone permission not granted, requesting...');
        const requested = await PermissionChecker.requestMicrophonePermission();
        if (!requested) {
          // User denied permission - silently return to let them use text chat
          // Don't show an alert - just reset to default mode
          console.log('🎤 [CHAT] Permission denied - returning to default mode');
          setVoiceUXMode('default');
          return;
        }
        
        // Update permission status after request
        const newStatus = await PermissionChecker.checkPermissions();
        setPermissionStatus(newStatus);
        console.log('🎤 [CHAT] Permission granted, new status:', newStatus);
      }
      
      // Voice recording works directly without needing to start a session
      // The audio processing happens when user stops recording
      setShowVoiceInstructions(false);
    } catch (error) {
      console.error('Failed to prepare voice:', error);
      // Don't show alert for permission-related errors during first setup
      // Just reset to default mode
      console.log('🎤 [CHAT] Error during voice setup - returning to default mode');
      setVoiceUXMode('default');
    }
  };

  const handleStopVoice = async () => {
    try {
      await stopVoiceSession();
    } catch (error) {
      console.error('Failed to stop voice session:', error);
    }
  };

  // Press and hold state management - UPDATED CODE v2
  // New tap-to-start/tap-to-stop voice functionality with TTS pause/play
  const handleMicButtonPress = async () => {
    console.log('🎤 [CHAT] Mic button pressed - Current UX mode:', voiceUXMode);
    console.log('🎤 [CHAT] Current voice state:', { isVoiceActive, isRecording, isVoiceConnecting });
    
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
        trackEvent(AnalyticsEvents.CHAT_VOICE_STARTED);
        setVoiceUXMode('recording-mode');
        await handleStartVoice();
        // If handleStartVoice fails (permission denied), voiceUXMode is reset to default inside it
        break;
        
      case 'recording-mode':
        // Second tap: Start recording
        console.log('🎤 [CHAT] Recording mode - starting active recording');
        try {
          setVoiceUXMode('active-recording');
          await setRecording(true);
          // Check if recording actually started - if not, reset to default
          // Note: setRecording doesn't throw on permission error anymore, but it sets isRecording to false
        } catch (error) {
          console.log('🎤 [CHAT] Failed to start recording - returning to default mode');
          setVoiceUXMode('default');
        }
        break;
        
      case 'active-recording':
        // Third tap: Stop recording and go to processing state
        console.log('🎤 [CHAT] Active recording - stopping recording and entering processing mode');
        trackEvent(AnalyticsEvents.CHAT_VOICE_SUBMITTED);
        setVoiceUXMode('processing');
        await setRecording(false);
        break;
        
      case 'processing':
        // During processing: Interrupt and start new recording
        console.log('⏸️ [CHAT] Processing mode - interrupting and starting new recording');
        
        // Stop audio playback (interrupt TTS)
        await stopAudioPlayback();
        
        // Clear processing timeout if active
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
        
        // Go directly to active recording
        setVoiceUXMode('active-recording');
        await setRecording(true);
        break;
        
      case 'tts-playing':
        // TTS is playing: Stop TTS and start new recording
        console.log('🎤 [CHAT] TTS playing - stopping TTS and starting recording');
        await stopAudioPlayback();
        setActiveTTSMessageId(null);
        setVoiceUXMode('recording-mode');
        await handleStartVoice();
        break;
        
      case 'tts-paused':
        // TTS is paused: Stop TTS and start new recording
        console.log('🎤 [CHAT] TTS paused - stopping TTS and starting recording');
        await stopAudioPlayback();
        setActiveTTSMessageId(null);
        setVoiceUXMode('recording-mode');
        await handleStartVoice();
        break;
    }
  };

  // Handle inline TTS pause/play button press
  const handleTTSControlPress = async () => {
    if (voiceUXMode === 'tts-playing') {
      console.log('⏸️ [CHAT] Inline button - pausing TTS');
      await pauseAudioPlayback();
      setVoiceUXMode('tts-paused');
    } else if (voiceUXMode === 'tts-paused') {
      console.log('▶️ [CHAT] Inline button - resuming TTS');
      await resumeAudioPlayback();
      setVoiceUXMode('tts-playing');
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
    
    // TTS playing/paused - mic button shows as default (controls are inline now)
    if (voiceUXMode === 'tts-playing' || voiceUXMode === 'tts-paused') {
      // Show mic as available to interrupt TTS and start new recording
      return voiceStyles.micButton;
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

  // Get mic button icon based on UX mode - always mic icon now (TTS controls are inline)
  const getMicButtonIcon = () => {
    return '🎤'; // Always mic icon
  };

  // Debug effect to log component render state
  useEffect(() => {
    console.log('🔍 [CHAT-RENDER] Component rendered with voice state:', {
      isVoiceActive,
      isRecording,
      isVoiceConnecting,
      isVoiceSupported,
      voiceUXMode
    });
  }, [isVoiceActive, isRecording, isVoiceConnecting, isVoiceSupported, voiceUXMode]);

  // Get voice status text for new UX pattern
  const getVoiceStatusText = () => {
    if (voiceUXMode === 'active-recording') return 'Tap the mic to stop';
    if (voiceUXMode === 'processing') return 'Processing...';
    if (voiceUXMode === 'recording-mode') return 'Tap the mic to record';
    if (voiceUXMode === 'tts-playing') return 'Speaking... (use inline controls)';
    if (voiceUXMode === 'tts-paused') return 'Paused (use inline controls)';
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
    setSessionMessageCount(prev => prev + 1);
    trackEvent(AnalyticsEvents.CHAT_MESSAGE_SENT, { inputMethod: 'text' }, { messageLength: input.trim().length });
    
    // Stop TTS if playing/paused when user sends a text message
    if (voiceUXMode === 'tts-playing' || voiceUXMode === 'tts-paused') {
      console.log('🛑 [CHAT] Stopping TTS - user sending text message');
      await stopAudioPlayback();
      setVoiceUXMode('default');
    }
    
    const userMessage = input.trim();
    const userThinkingId = `user-thinking-${Date.now()}`;
    
    // STEP 1: Immediately show user "thinking" dots (will show for 3 seconds - matches voice UX)
    const userThinkingMessage: ChatMessage = { 
      id: userThinkingId, 
      type: 'user-thinking', 
      text: '' 
    };
    
    setMessages(prev => [...prev, userThinkingMessage]);
    
    // More aggressive input clearing for button press
    setInput('');
    textInputRef.current?.clear();
    textInputRef.current?.blur();
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
    
    setIsLoading(true);

    // STEP 2: Start backend call immediately (in background)
    const typingId = `typing-${Date.now()}`;
    
    // Prepend game context to first message if coming from GameSetup
    let queryWithContext = userMessage;
    if (gameContextRef.current && !conversationId) {
      const { gameName, playerCount } = gameContextRef.current;
      queryWithContext = `[Context: The user was just setting up the board game "${gameName}" for ${playerCount} players and needs more help.] ${userMessage}`;
      // Clear context after first use - subsequent messages will use conversationId
      gameContextRef.current = null;
    }
    
    const responsePromise = getRecommendations({
      Query: queryWithContext,
      UserId: userId,
      ConversationId: conversationId
    });

    // STEP 3: Wait 3 seconds before showing user message (masks backend latency)
    await new Promise<void>(resolve => setTimeout(() => {
      // Replace user thinking indicator with actual user message
      const userMessageObj: ChatMessage = { 
        id: userThinkingId, 
        type: 'user', 
        text: userMessage 
      };
      
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== userThinkingId);
        return [...filtered, userMessageObj];
      });
      
      // Add system typing indicator
      const typingMessage: ChatMessage = { id: typingId, type: 'typing', text: '' };
      setMessages(prev => [...prev, typingMessage]);
      
      resolve();
    }, 3000));

    try {
      // Wait for backend response that was started earlier
      const response = await responsePromise;

      setMessages(prev => prev.filter(msg => msg.id !== typingId));

      if (response.threadId) {
        setConversationId(response.threadId);
      }

      if (response.responseText) {
        const systemMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          text: response.responseText
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      setHasSessionErrors(true);
      trackEvent(AnalyticsEvents.ERROR_API, { source: 'chat', error: String(error) });
      setMessages(prev => prev.filter(msg => msg.id !== typingId));
      const errorMessage: ChatMessage = {
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

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.type === 'typing') {
      return <TypingIndicator />;
    }
    
    // Show system thinking indicator for "thinking" type messages
    if (item.type === 'thinking') {
      return <SystemThinkingIndicator />;
    }
    
    // Show user thinking indicator for text-initiated messages (matches voice UX)
    if (item.type === 'user-thinking') {
      return <UserThinkingIndicator />;
    }
    
    // Show voice processing indicator for "🎤..." messages
    if (item.text === '🎤...' || item.text?.startsWith('🎤.')) {
      return <VoiceProcessingIndicator />;
    }
    
    // Check if this is the message currently playing TTS
    const isActiveTTSMessage = item.id === activeTTSMessageId && 
      (voiceUXMode === 'tts-playing' || voiceUXMode === 'tts-paused');
    
    // Get the inline TTS control icon
    const getTTSControlIcon = () => {
      if (voiceUXMode === 'tts-playing') return '⏸️';
      if (voiceUXMode === 'tts-paused') return '▶️';
      return null;
    };
    
    // Determine if this message should render markdown (system AI responses)
    const shouldRenderMarkdown = item.type === 'system' && item.text && item.text.length > 0;
    
    // Get the icon to display (mic for voice, or TTS controls)
    const getIcon = () => {
      if (!item.isVoiceMessage) return null;
      if (item.type === 'system' && isActiveTTSMessage) {
        return getTTSControlIcon();
      }
      return '🎤';
    };
    
    const icon = getIcon();
    
    // Wrap system bubble in TouchableOpacity if it's the active TTS message
    const bubbleContent = (
      <View 
        style={item.type === 'user' ? styles.userBubble : styles.systemBubble}
        testID={item.type === 'user' ? 'user-message' : 'system-message'}
        {...(Platform.OS === 'web' && { 
          'data-testid': item.type === 'user' ? 'user-message' : 'system-message' 
        })}
      >
        {/* Render markdown for system messages with icon inline */}
        {shouldRenderMarkdown ? (
          <MarkdownText 
            text={icon ? `${icon} ${item.text || ''}` : (item.text || '')} 
            isUserMessage={false}
          />
        ) : (
          <Text style={styles.bubbleText}>
            {icon && <Text style={styles.voiceIcon}>{icon} </Text>}
            {item.text}
          </Text>
        )}
      </View>
    );

    // Make the bubble tappable for TTS control when it's the active TTS message
    if (item.type === 'system' && isActiveTTSMessage) {
      return (
        <TouchableOpacity onPress={handleTTSControlPress} activeOpacity={0.7}>
          {bubbleContent}
        </TouchableOpacity>
      );
    }

    return bubbleContent;
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
        <BackButton onPress={async () => {
          // Stop TTS if playing when navigating away
          await stopAudioPlayback();
          // Reset voice UX mode - only stop recording if actually recording
          if (voiceUXMode === 'recording-mode' || voiceUXMode === 'active-recording' || voiceUXMode === 'processing') {
            await setRecording(false);
          }
          setVoiceUXMode('default');
          // Note: Don't clear conversationId - preserve thread context
          navigation.goBack();
        }} />

        {/* New Chat Thread Button */}
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={async () => {
            // Stop TTS immediately when '+' is tapped (before Alert)
            await stopAudioPlayback();
            
            Alert.alert(
              'Start New Chat',
              'Your current chat thread will be permanently deleted. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'New Chat',
                  style: 'destructive',
                  onPress: async () => {
                    trackEvent(AnalyticsEvents.CHAT_NEW_THREAD);
                    // Stop voice recording if active
                    if (voiceUXMode !== 'default') {
                      await setRecording(false);
                      setVoiceUXMode('default');
                    }
                    // Clear conversation using context
                    clearChat();
                    setInput('');
                    // Reset rating prompt session tracking
                    setSessionMessageCount(0);
                    setHasSessionErrors(false);
                    ratingPromptShownRef.current = false;
                    setShowRatingBanner(false);
                  }
                }
              ]
            );
          }}
          testID="new-chat-button"
        >
          <Text style={styles.newChatIcon}>+</Text>
        </TouchableOpacity>

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

          {/* Rating prompt banner */}
          <RatingBanner
            visible={showRatingBanner}
            onRate={handleRatingRate}
            onDismiss={handleRatingDismiss}
          />

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

          {/* Input bar - show in default mode and during TTS playback (inline controls in messages) */}
          {(voiceUXMode === 'default' || voiceUXMode === 'tts-playing' || voiceUXMode === 'tts-paused') && (
            <View style={styles.inputBar}>
              <TextInput
                ref={textInputRef}
                value={input}
                onChangeText={handleInputChange}
                placeholder="Message"
                placeholderTextColor={Colors.grayPlaceholder}
                style={styles.input}
                editable={!isLoading && !isProcessing}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                testID="chat-input"
                {...(Platform.OS === 'web' && { 'data-testid': 'chat-input' })}
              />
              
              {/* Voice Controls - mic button in input bar */}
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
                    disabled={isProcessing}
                    testID="mic-button"
                    {...(Platform.OS === 'web' && { 'data-testid': 'mic-button' })}
                  >
                    <Text style={voiceStyles.micIcon}>{getMicButtonIcon()}</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <TouchableOpacity 
                onPress={handleSend} 
                style={styles.sendButton}
                disabled={isLoading || isProcessing}
                testID="send-button"
                {...(Platform.OS === 'web' && { 'data-testid': 'send-button' })}
              >
                <Text style={styles.sendText}>{isLoading ? '...' : '➤'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Voice Mode Overlay - centered mic with status text underneath */}
          {/* Only show overlay for recording modes, NOT during TTS (TTS controls are inline in message bubbles) */}
          {(voiceUXMode === 'recording-mode' || voiceUXMode === 'active-recording' || voiceUXMode === 'processing') && (
            <TouchableOpacity 
              style={voiceStyles.voiceModeOverlayTouchable}
              activeOpacity={1}
              onPress={async () => {
                console.log('👆 [CHAT] Overlay tapped - Current mode:', voiceUXMode);
                
                // If actively recording, stop and submit (same as tapping mic button)
                if (voiceUXMode === 'active-recording') {
                  console.log('👆 [CHAT] Overlay tapped during recording - stopping and submitting');
                  setVoiceUXMode('processing');
                  await setRecording(false);
                  return; // Let the normal processing flow handle the rest
                }
                
                // For other modes (recording-mode or processing), dismiss and return to default
                console.log('👆 [CHAT] Overlay tapped - dismissing voice mode');
                
                // Stop voice session if needed
                if (voiceUXMode === 'recording-mode') {
                  await handleStopVoice();
                }
                
                setVoiceUXMode('default');
              }}
            >
              <View style={voiceStyles.voiceModeOverlay}>
                <Animated.View 
                  style={{
                    transform: [{ 
                      scale: voiceUXMode === 'active-recording' 
                        ? Animated.multiply(micScale, pulseAnim) 
                        : (voiceUXMode === 'processing' ? pulseAnim : micScale)
                    }]
                  }}
                >
                  <TouchableOpacity
                    style={[
                      voiceStyles.micButtonLarge,
                      voiceUXMode === 'active-recording' && voiceStyles.micButtonLargeRecording,
                      voiceUXMode === 'processing' && voiceStyles.micButtonLargeProcessing,
                      voiceUXMode === 'recording-mode' && voiceStyles.micButtonLargeReady,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleMicButtonPress}
                    testID="mic-button-large"
                  >
                    <Text style={voiceStyles.micIconLarge}>{getMicButtonIcon()}</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Text style={voiceStyles.voiceModeStatusText}>
                  {getVoiceStatusText()}
                </Text>
              </View>
            </TouchableOpacity>
          )}

        </View>

      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
