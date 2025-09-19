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
    console.log(' [FOUNDRY-HOOK] Connection state changed:', state);
    
    setSessionState(prev => ({
      ...prev,
      isConnecting: state.state === 'connecting',
      isActive: state.state === 'connected',
      error: state.state === 'failed' ? 'Connection failed' : null,
      sessionId: state.sessionId || prev.sessionId
    }));

    // Notify parent component of voice response events
    if (state.state === 'connected' && config?.onVoiceResponse) {
      config.onVoiceResponse({
        responseText: 'Voice session connected',
        isUserMessage: false,
        conversationId: state.sessionId
      });
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
      if (voiceServiceRef.current?.isSessionActive()) {
        voiceServiceRef.current.stopVoiceSession();
      }
    };
  }, [handleRemoteAudio, handleConnectionStateChange, handleTranscriptUpdate]);

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
        console.log(' [FOUNDRY-HOOK] Voice session started successfully');
        setSessionState(prev => ({ 
          ...prev, 
          isRecording: true,
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

  return {
    sessionState,
    startVoiceSession,
    stopVoiceSession,
    clearError,
    clearTranscript,
    setRecording: () => {}, // No manual recording control - recording happens automatically
    isSupported: true, // Azure OpenAI Realtime API is always supported
    // Legacy compatibility properties
    isActive: sessionState.isActive,
    isConnecting: sessionState.isConnecting,
    isRecording: sessionState.isRecording,
    error: sessionState.error
  };
}
