import { useState, useRef, useCallback, useEffect } from 'react';
import { MediaStream } from 'react-native-webrtc';
import { 
  FoundryVoiceService, 
  VoiceConnectionState, 
  VoiceSessionRequest 
} from '../services/foundryVoiceService';

export interface VoiceSessionState {
  isActive: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  error: string | null;
  sessionId: string | null;
  transcript: string;
}

export interface VoiceSessionConfig {
  onVoiceResponse?: (response: { 
    responseText: string; 
    threadId?: string; 
    isUserMessage?: boolean;
    conversationId?: string;
  }) => void;
}

export function useFoundryVoiceSession(config?: VoiceSessionConfig) {
  const [sessionState, setSessionState] = useState<VoiceSessionState>({
    isActive: false,
    isConnecting: false,
    isRecording: false,
    error: null,
    sessionId: null,
    transcript: ''
  });

  const voiceServiceRef = useRef<FoundryVoiceService | null>(null);

  // Handle remote audio stream from AI voice
  const handleRemoteAudio = useCallback((stream: MediaStream) => {
    console.log(' [FOUNDRY-HOOK] Received remote audio stream');
    // Audio playback is handled directly by the service through AudioContext
  }, []);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback((state: VoiceConnectionState) => {
    console.log('🔄 [FOUNDRY-HOOK] Connection state changed:', state);
    
    setSessionState(prev => ({
      ...prev,
      isConnecting: state.state === 'connecting',
      isActive: state.state === 'connected',
      error: state.state === 'failed' ? 'Connection failed' : null,
      sessionId: state.sessionId || prev.sessionId,
      // CRITICAL FIX: Reset recording state when session disconnects
      isRecording: state.state === 'connected' ? prev.isRecording : false
    }));

    // Don't add "Voice session connected" to chat - just log it
    if (state.state === 'connected') {
      console.log('🟢 [FOUNDRY-HOOK] Voice session successfully connected, ready for recording');
    }
  }, [config]);

  // Handle transcript updates
  const handleTranscriptUpdate = useCallback((transcript: string) => {
    console.log(' [FOUNDRY-HOOK] Transcript update:', transcript);
    
    setSessionState(prev => ({
      ...prev,
      transcript: prev.transcript + '\n' + transcript
    }));

    // Notify parent component of transcript updates
    if (config?.onVoiceResponse) {
      const isUserMessage = transcript.startsWith('[User]:');
      config.onVoiceResponse({
        responseText: transcript.replace(/^\[(User|AI)\]: /, ''),
        isUserMessage,
        conversationId: sessionState.sessionId || undefined
      });
    }
  }, [config, sessionState.sessionId]);

  // Initialize voice service
  useEffect(() => {
    if (!voiceServiceRef.current) {
      voiceServiceRef.current = new FoundryVoiceService(
        handleRemoteAudio,
        handleConnectionStateChange,
        handleTranscriptUpdate
      );
    }

    return () => {
      // Only cleanup on unmount, not on every render
      if (voiceServiceRef.current?.isSessionActive()) {
        console.log('🧹 [FOUNDRY-HOOK] Cleaning up voice service on unmount');
        voiceServiceRef.current.stopVoiceSession();
      }
    };
  }, []); // Remove dependencies to prevent cleanup on every render

  // Start voice session
  const startVoiceSession = useCallback(async (request: VoiceSessionRequest): Promise<boolean> => {
    if (!voiceServiceRef.current) {
      console.error(' [FOUNDRY-HOOK] Voice service not initialized');
      setSessionState(prev => ({ ...prev, error: 'Voice service not initialized' }));
      return false;
    }

    try {
      console.log(' [FOUNDRY-HOOK] Starting voice session with request:', request);
      
      setSessionState(prev => ({ 
        ...prev, 
        error: null, 
        isConnecting: true,
        transcript: '' 
      }));

      const success = await voiceServiceRef.current.startVoiceSession(request);
      
      if (success) {
        console.log('🟢 [FOUNDRY-HOOK] Voice session started successfully');
        setSessionState(prev => ({ 
          ...prev, 
          isRecording: false, // Don't auto-start recording - wait for user press-and-hold
          sessionId: voiceServiceRef.current?.getCurrentSession()?.sessionId || null
        }));
      } else {
        console.error(' [FOUNDRY-HOOK] Failed to start voice session');
        setSessionState(prev => ({ 
          ...prev, 
          error: 'Failed to start voice session',
          isConnecting: false 
        }));
      }

      return success;
    } catch (error) {
      console.error(' [FOUNDRY-HOOK] Error starting voice session:', error);
      setSessionState(prev => ({ 
        ...prev, 
        error: `Error starting voice session: ${error}`,
        isConnecting: false 
      }));
      return false;
    }
  }, []);

  // Stop voice session
  const stopVoiceSession = useCallback(async (): Promise<void> => {
    if (!voiceServiceRef.current) {
      console.warn(' [FOUNDRY-HOOK] Voice service not initialized');
      return;
    }

    try {
      console.log(' [FOUNDRY-HOOK] Stopping voice session');
      
      await voiceServiceRef.current.stopVoiceSession();
      
      setSessionState(prev => ({
        ...prev,
        isActive: false,
        isConnecting: false,
        isRecording: false,
        sessionId: null
      }));

      console.log(' [FOUNDRY-HOOK] Voice session stopped successfully');
    } catch (error) {
      console.error(' [FOUNDRY-HOOK] Error stopping voice session:', error);
      setSessionState(prev => ({ 
        ...prev, 
        error: `Error stopping voice session: ${error}` 
      }));
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setSessionState(prev => ({ ...prev, error: null }));
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setSessionState(prev => ({ ...prev, transcript: '' }));
  }, []);

  // Set recording state (push-to-talk control)
  const setRecording = useCallback((recording: boolean) => {
    console.log(`🎤 [FOUNDRY-HOOK] setRecording called with: ${recording}`);
    console.log(`🎤 [FOUNDRY-HOOK] Current session state:`, {
      isActive: sessionState.isActive,
      isConnecting: sessionState.isConnecting,
      isRecording: sessionState.isRecording,
      sessionId: sessionState.sessionId,
      hasVoiceService: !!voiceServiceRef.current,
      isSessionActive: voiceServiceRef.current?.isSessionActive()
    });
    
    if (!voiceServiceRef.current?.isSessionActive()) {
      console.warn('🔴 [FOUNDRY-HOOK] Cannot set recording - no active voice session');
      return;
    }

    console.log(`🎤 [FOUNDRY-HOOK] Setting recording state to: ${recording}`);
    voiceServiceRef.current.setRecording(recording);
    
    setSessionState(prev => {
      const newState = { 
        ...prev, 
        isRecording: recording 
      };
      console.log(`🎤 [FOUNDRY-HOOK] Updated session state:`, newState);
      return newState;
    });
  }, []);

  // Stop audio playback (interrupt AI speaking)
  const stopAudioPlayback = useCallback(async () => {
    if (!voiceServiceRef.current) {
      console.warn('⚠️ [FOUNDRY-HOOK] Voice service not initialized');
      return;
    }

    console.log('⏸️ [FOUNDRY-HOOK] Stopping audio playback');
    await voiceServiceRef.current.stopAudioPlayback();
  }, []);

  // Check if AI is currently speaking
  const isAISpeaking = useCallback((): boolean => {
    if (!voiceServiceRef.current) {
      return false;
    }
    return voiceServiceRef.current.isAISpeaking();
  }, []);

  return {
    sessionState,
    startVoiceSession,
    stopVoiceSession,
    clearError,
    clearTranscript,
    setRecording,
    stopAudioPlayback,
    isAISpeaking,
    isSupported: true, // Azure OpenAI Realtime API is always supported
    // Legacy compatibility properties
    isActive: sessionState.isActive,
    isConnecting: sessionState.isConnecting,
    isRecording: sessionState.isRecording,
    error: sessionState.error
  };
}
