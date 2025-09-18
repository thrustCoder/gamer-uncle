import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { mediaDevices, RTCPeerConnection, MediaStream } from 'react-native-webrtc';
import * as Speech from 'expo-speech';
import { VoiceConnectionState, VoiceSessionRequest } from '../services/foundryVoiceService';
import { speechRecognitionService, SpeechRecognitionResult } from '../services/speechRecognitionService';

export interface VoiceSessionState {
  isActive: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  error: string | null;
  sessionId: string | null;
}

// Enhanced Foundry Voice Service that integrates with real backend
class EnhancedFoundryVoiceService {
  private apiBaseUrl: string;
  private onRemoteAudio: (stream: MediaStream) => void;
  private onConnectionStateChange: (state: VoiceConnectionState) => void;
  private onVoiceResponse?: (response: { responseText: string; threadId?: string; isUserMessage?: boolean }) => void;
  private currentSessionId: string | null = null;

  constructor(
    apiBaseUrl: string,
    onRemoteAudio: (stream: MediaStream) => void,
    onConnectionStateChange: (state: VoiceConnectionState) => void,
    onVoiceResponse?: (response: { responseText: string; threadId?: string; isUserMessage?: boolean }) => void
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.onRemoteAudio = onRemoteAudio;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onVoiceResponse = onVoiceResponse;
  }

  async startVoiceSession(request: VoiceSessionRequest): Promise<boolean> {
    console.log('🎤 [FOUNDRY] Starting enhanced Foundry voice session:', request);
    console.log('🌐 [FOUNDRY] API Base URL:', this.apiBaseUrl);
    
    try {
      // Start connection process
      this.onConnectionStateChange({ state: 'connecting' });
      
      const apiUrl = `${this.apiBaseUrl}/api/voice/sessions`;
      console.log('🔗 [FOUNDRY] Calling API:', apiUrl);
      
      // Call the backend API to create a voice session
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      console.log('📡 [FOUNDRY] API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [FOUNDRY] API Error Response:', errorText);
        throw new Error(`Failed to create voice session: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const voiceSession = await response.json();
      this.currentSessionId = voiceSession.sessionId;
      
      console.log('🟢 [FOUNDRY] Voice session created:', voiceSession.sessionId);
      
      // Simulate successful connection (real WebRTC integration would go here)
      this.onConnectionStateChange({ 
        state: 'connected', 
        sessionId: voiceSession.sessionId
      });
      
      return true;
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to start voice session:', error);
      
      // Better error logging with type safety
      if (error instanceof Error) {
        console.error('🔴 [FOUNDRY] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      } else {
        console.error('🔴 [FOUNDRY] Unknown error type:', error);
      }
      
      this.onConnectionStateChange({ state: 'failed' });
      return false;
    }
  }

  async processVoiceInput(transcription: string): Promise<void> {
    if (!this.currentSessionId) {
      console.error('🔴 [FOUNDRY] No active session for voice input');
      return;
    }

    try {
      console.log('🎤 [FOUNDRY] Processing voice input:', transcription);
      
      // For now, send the transcription to the regular chat API 
      // In a full implementation, this would use the voice session's conversation context
      console.log('🔍 [FOUNDRY] Making API call to:', `${this.apiBaseUrl}/api/recommendations`);
      console.log('🔍 [FOUNDRY] Request body:', JSON.stringify({
        query: transcription,
        conversationId: this.currentSessionId
      }));

      const response = await fetch(`${this.apiBaseUrl}/api/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: transcription,
          conversationId: this.currentSessionId
        }),
      });

      console.log('🔍 [FOUNDRY] Response status:', response.status);
      console.log('🔍 [FOUNDRY] Response statusText:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [FOUNDRY] API Error Response:', errorText);
        throw new Error(`Failed to get AI response: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const aiResponse = await response.json();
      
      console.log('🔍 [FOUNDRY] Full API response:', JSON.stringify(aiResponse, null, 2));
      console.log('🎯 [FOUNDRY] Received AI response via voice session');
      
      // Extract response text
      const responseText = aiResponse.responseText || aiResponse.response || 'No response received';
      console.log('🎯 [FOUNDRY] Response text:', responseText);
      
      // Send the response to chat
      if (this.onVoiceResponse) {
        console.log('🎯 [FOUNDRY] Sending response to chat:', responseText);
        
        this.onVoiceResponse({
          responseText: responseText,
          threadId: aiResponse.threadId,
          isUserMessage: false
        });
      }

      // Play the AI response as voice using TTS
      await this.playVoiceResponse(responseText);
      
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to process voice input:', error);
      
      if (this.onVoiceResponse) {
        this.onVoiceResponse({
          responseText: "Sorry, I had trouble processing your voice input. Please try again.",
          isUserMessage: false
        });
      }
    }
  }

  async playVoiceResponse(text: string): Promise<void> {
    try {
      console.log('🔊 [FOUNDRY] Playing TTS response:', text.substring(0, 50) + '...');
      
      // Get available voices first
      const availableVoices = await Speech.getAvailableVoicesAsync();
      console.log('🔊 [FOUNDRY] Available voices:', availableVoices.map(v => v.identifier).slice(0, 5));
      
      // Find a suitable male voice for "Gamer Uncle" character
      const preferredVoices = [
        // iOS male voices (older/mature sounding)
        'com.apple.ttsbundle.Daniel-compact',
        'com.apple.voice.compact.en-US.Samantha',
        'com.apple.ttsbundle.Alex',
        // Android male voices
        'en-us-x-male-1',
        'en-us-x-male-2',
        'en-us-x-male-3'
      ];
      
      let selectedVoice = undefined;
      for (const voiceId of preferredVoices) {
        if (availableVoices.some(v => v.identifier === voiceId || v.name?.toLowerCase().includes('male'))) {
          selectedVoice = voiceId;
          console.log('🎭 [FOUNDRY] Selected "Gamer Uncle" voice:', voiceId);
          break;
        }
      }
      
      // Configure speech options for "Gamer Uncle" character
      const speechOptions = {
        language: 'en-US',
        pitch: 0.75, // Lower pitch for mature, friendly uncle voice
        rate: 0.8,   // Conversational pace, not rushed
        voice: selectedVoice,
      };

      // Stop any currently playing speech
      await Speech.stop();
      
      // Speak the AI response with "Gamer Uncle" characteristics
      await Speech.speak(text, speechOptions);
      
      console.log('🟢 [FOUNDRY] "Gamer Uncle" TTS playback completed');
    } catch (error) {
      console.error('🔴 [FOUNDRY] TTS playback failed:', error);
      
      // Fallback with basic male voice settings
      try {
        await Speech.speak(text, {
          language: 'en-US',
          pitch: 0.75,
          rate: 0.8
        });
        console.log('🟡 [FOUNDRY] TTS playback completed with fallback voice');
      } catch (fallbackError) {
        console.error('🔴 [FOUNDRY] Fallback TTS also failed:', fallbackError);
      }
    }
  }

  async endVoiceSession(): Promise<void> {
    console.log('🔄 [FOUNDRY] Ending voice session');
    
    // Stop any ongoing TTS playback
    try {
      await Speech.stop();
      console.log('🔇 [FOUNDRY] Stopped TTS playback');
    } catch (error) {
      console.error('🔴 [FOUNDRY] Error stopping TTS:', error);
    }
    
    this.onConnectionStateChange({ state: 'disconnected' });
  }

  async stopTTS(): Promise<void> {
    try {
      await Speech.stop();
      console.log('🔇 [FOUNDRY] TTS stopped by user');
    } catch (error) {
      console.error('🔴 [FOUNDRY] Error stopping TTS:', error);
    }
  }
}

export const useFoundryVoiceSession = (onVoiceResponse?: (response: { responseText: string; threadId?: string; isUserMessage?: boolean }) => void) => {
  const [state, setState] = useState<VoiceSessionState>({
    isActive: false,
    isConnecting: false,
    isRecording: false,
    error: null,
    sessionId: null,
  });

  const foundryServiceRef = useRef<EnhancedFoundryVoiceService | null>(null);
  const transcriptionRef = useRef<string>('');
  
  // Use the same API base URL as the rest of the app
  const getApiBaseUrl = (): string => {
    // Use Azure Front Door endpoint for consistency
    return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net';
  };
  
  const apiBaseUrl = getApiBaseUrl();

  const updateState = useCallback((updates: Partial<VoiceSessionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Handle remote audio stream from Foundry
  const handleRemoteAudio = useCallback((stream: MediaStream) => {
    try {
      console.log('🎵 [FOUNDRY] Received remote audio stream');
      
      // For React Native, simulate voice response in chat for demonstration
      if (onVoiceResponse) {
        onVoiceResponse({
          responseText: "🎵 AI voice response received (Foundry Live Voice integration active)",
          isUserMessage: false
        });
      }
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to handle remote audio:', error);
      updateState({ error: 'Failed to play AI voice response' });
    }
  }, [updateState, onVoiceResponse]);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback((connectionState: VoiceConnectionState) => {
    console.log('🔗 [FOUNDRY] Connection state changed:', connectionState);
    
    updateState({
      sessionId: connectionState.sessionId || null,
    });

    switch (connectionState.state) {
      case 'connecting':
        updateState({ isConnecting: true, isActive: false, error: null });
        break;
      case 'connected':
        updateState({ isConnecting: false, isActive: true, error: null });
        
        // Show connection success in chat
        if (onVoiceResponse) {
          onVoiceResponse({
            responseText: "🟢 Connected to Foundry Live Voice! You can now speak naturally and I'll respond with voice.",
            isUserMessage: false
          });
        }
        break;
      case 'disconnected':
        updateState({ isConnecting: false, isActive: false, error: null });
        break;
      case 'failed':
        updateState({ 
          isConnecting: false, 
          isActive: false, 
          error: 'Voice connection failed. Please try again.' 
        });
        break;
    }
  }, [updateState, onVoiceResponse]);

  // Start voice session with Foundry Live Voice
  const startVoiceSession = useCallback(async (request: VoiceSessionRequest) => {
    console.log('🎤 [FOUNDRY] Starting Foundry Live Voice session:', request);
    
    try {
      clearError();
      
      // Create enhanced Foundry service instance
      foundryServiceRef.current = new EnhancedFoundryVoiceService(
        apiBaseUrl,
        handleRemoteAudio,
        handleConnectionStateChange,
        onVoiceResponse
      );

      // Start the voice session
      const success = await foundryServiceRef.current.startVoiceSession(request);
      
      if (!success) {
        updateState({ error: 'Failed to start voice session. Please try again.' });
        foundryServiceRef.current = null;
      }
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to start voice session:', error);
      updateState({ error: 'Failed to start voice session. Please check your microphone permissions.' });
      foundryServiceRef.current = null;
    }
  }, [clearError, handleRemoteAudio, handleConnectionStateChange, updateState, onVoiceResponse, apiBaseUrl]);

  // Stop voice session
  const stopVoiceSession = useCallback(async () => {
    console.log('🔄 [FOUNDRY] Stopping voice session');
    
    try {
      if (foundryServiceRef.current) {
        await foundryServiceRef.current.endVoiceSession();
        foundryServiceRef.current = null;
      }

      updateState({ 
        isActive: false, 
        isConnecting: false, 
        isRecording: false, 
        sessionId: null 
      });

      console.log('🟢 [FOUNDRY] Voice session stopped successfully');
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to stop voice session:', error);
      updateState({ error: 'Failed to stop voice session properly.' });
    }
  }, [updateState]);

  // Set recording state and handle speech recognition
  const setRecording = useCallback(async (recording: boolean) => {
    updateState({ isRecording: recording });
    
    if (recording) {
      console.log('🎤 [FOUNDRY] Push-to-talk activated - starting speech recognition');
      
      // Start speech recognition when recording begins
      try {
        const started = await speechRecognitionService.startListening({
          onResult: (result: SpeechRecognitionResult) => {
            console.log('🟢 [FOUNDRY] Speech recognized:', result.transcription);
            transcriptionRef.current = result.transcription;
          },
          onError: (error: string) => {
            console.error('🔴 [FOUNDRY] Speech recognition error:', error);
            updateState({ error: `Speech recognition failed: ${error}` });
          }
        });

        if (!started) {
          updateState({ error: 'Failed to start speech recognition' });
        }
      } catch (error) {
        console.error('🔴 [FOUNDRY] Failed to start speech recognition:', error);
        updateState({ error: 'Microphone access denied or not available' });
      }
    } else {
      console.log('🎤 [FOUNDRY] Push-to-talk released - processing speech');
      
      // Stop speech recognition and process the transcription
      try {
        await speechRecognitionService.stopListening();
        
        if (transcriptionRef.current.trim()) {
          console.log('🎯 [FOUNDRY] Processing transcription:', transcriptionRef.current);
          
          // Add user message to chat immediately
          if (onVoiceResponse) {
            onVoiceResponse({
              responseText: transcriptionRef.current,
              isUserMessage: true
            });
          }
          
          // Process the voice input with Foundry service
          if (foundryServiceRef.current) {
            await foundryServiceRef.current.processVoiceInput(transcriptionRef.current);
          } else {
            console.error('🔴 [FOUNDRY] No active Foundry service to process voice input');
            if (onVoiceResponse) {
              onVoiceResponse({
                responseText: "Voice session not active. Please start a voice session first.",
                isUserMessage: false
              });
            }
          }
          
          // Clear the transcription
          transcriptionRef.current = '';
        } else {
          console.log('⚠️ [FOUNDRY] No speech detected');
          if (onVoiceResponse) {
            onVoiceResponse({
              responseText: "No speech detected. Please try speaking again.",
              isUserMessage: false
            });
          }
        }
      } catch (error) {
        console.error('🔴 [FOUNDRY] Failed to process speech:', error);
        updateState({ error: 'Failed to process speech input' });
      }
    }
  }, [updateState, onVoiceResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (foundryServiceRef.current) {
        foundryServiceRef.current.endVoiceSession();
      }
    };
  }, []);

  // Retry mechanism
  const retryVoiceSession = useCallback(async (request: VoiceSessionRequest, retryCount = 0) => {
    const maxRetries = 3;
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);

    if (retryCount < maxRetries) {
      setTimeout(() => {
        console.log(`🔄 [FOUNDRY] Retrying voice session (attempt ${retryCount + 1}/${maxRetries})`);
        startVoiceSession(request).catch(() => {
          retryVoiceSession(request, retryCount + 1);
        });
      }, backoffDelay);
    } else {
      updateState({ error: 'Failed to establish voice connection after multiple attempts.' });
    }
  }, [startVoiceSession, updateState]);

  return {
    // State
    ...state,
    
    // Actions
    startVoiceSession,
    stopVoiceSession,
    setRecording,
    clearError,
    retryVoiceSession,
    
    // Utilities
    isSupported: !!(mediaDevices && RTCPeerConnection),
  };
};