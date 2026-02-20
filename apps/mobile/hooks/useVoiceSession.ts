import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream } from 'react-native-webrtc';
import axios from 'axios';
import { speechRecognitionService, SpeechRecognitionResult } from '../services/speechRecognitionService';
import { getRecommendations } from '../services/ApiClient';
import { VoiceAudioService, SilenceDetectionConfig } from '../services/voiceAudioService';
import { getApiBaseUrl } from '../config/apiConfig';

// Types for voice session - matching backend C# models exactly
export interface VoiceSessionRequest {
  Query: string;                // Required - Free-form board game question or request
  ConversationId?: string;      // Optional - Links to existing text conversation
  UserId?: string;              // Optional - For user tracking
}

export interface VoiceSessionResponse {
  SessionId: string;              // Required - Voice session identifier
  WebRtcToken: string;           // Required - Authentication token for WebRTC
  FoundryConnectionUrl: string;   // Required - Azure AI Foundry connection URL
  ExpiresAt: string;             // Session expiration time (ISO string)
  ConversationId?: string;       // Optional - Links to text conversation if provided  
  InitialResponse?: string;      // Optional - AI's initial spoken response to user's query
}

export interface VoiceSessionState {
  isActive: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  error: string | null;
  sessionId: string | null;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

export interface RecordingSafetyConfig {
  maxRecordingDurationMs?: number;  // Max recording time (e.g., 60000 for 1 minute)
  silenceThresholdDb?: number;       // dB threshold for silence (e.g., -40)
  silenceDurationMs?: number;        // How long silence triggers stop (e.g., 10000)
  onAutoStop?: (reason: 'max-duration' | 'silence') => void;
}

// Extended voice response with TTS control events
export interface VoiceResponseExtended {
  responseText: string;
  threadId?: string;
  isUserMessage?: boolean;
  eventType?: 'transcription' | 'thinking' | 'response' | 'tts-start' | 'tts-end' | 'direct-message';
}

export const useVoiceSession = (
  onVoiceResponse?: (response: VoiceResponseExtended) => void,
  conversationId?: string | null,
  recordingSafetyConfig?: RecordingSafetyConfig,
  gameContext?: string | null
) => {
  const [state, setState] = useState<VoiceSessionState>({
    isActive: false,
    isConnecting: false,
    isRecording: false,
    error: null,
    sessionId: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  
  // Voice audio service for simplified audio processing
  const voiceAudioServiceRef = useRef<VoiceAudioService>(new VoiceAudioService(getApiBaseUrl()));
  
  // On-device STT transcription collected during recording
  const onDeviceTranscriptionRef = useRef<string>('');
  
  // 🚀 OPTIMIZATION: Pre-initialized state for faster startup
  // Note: Permission request is deferred until user actually taps the mic button
  // This provides a better UX by not prompting for permissions on screen load
  const [isPreInitialized, setIsPreInitialized] = useState(false);

  // Mark as pre-initialized without requesting permissions
  // Actual permission request happens when user taps mic button (on-demand)
  useEffect(() => {
    // No pre-initialization of audio permissions - defer until user action
    // This avoids the permission popup appearing when user navigates to chat screen
    console.log('🟡 [DEBUG] Voice capabilities ready (permissions will be requested on first mic tap)');
  }, []);

  const updateState = useCallback((updates: Partial<VoiceSessionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Request microphone permissions and get local audio stream
  const requestAudioPermissions = useCallback(async (): Promise<MediaStream | null> => {
    try {
      console.log('🟡 [DEBUG] Requesting audio permissions...');
      
      const stream = await mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimized for voice
        } as any, // Type assertion for react-native-webrtc compatibility
      });
      
      console.log('🟢 [DEBUG] Audio permissions granted, stream:', {
        id: stream.id,
        tracks: stream.getTracks().length
      });
      
      return stream;
    } catch (error) {
      console.error('🔴 [DEBUG] Failed to get audio permissions:', error);
      updateState({ error: 'Microphone access denied. Please grant microphone permissions in Settings > Gamer Uncle > Microphone.' });
      return null;
    }
  }, [updateState]);

  // Create voice session with backend - simplified for free-form input/output
  const createVoiceSession = useCallback(async (request: VoiceSessionRequest): Promise<VoiceSessionResponse | null> => {
    try {
      console.log('🟡 [DEBUG] Creating voice session:', { 
        url: 'voice/sessions', 
        request: request,
        baseURL: api.defaults.baseURL 
      });
      
      const response = await api.post('voice/sessions', request, {
        timeout: 30000, // 30 second timeout for voice session creation
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('🟢 [DEBUG] Voice session created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔴 [DEBUG] Failed to create voice session:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('🔴 [DEBUG] Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method
        });
        
        if (error.response?.status === 429) {
          updateState({ error: 'Too many requests. Please wait a moment and try again.' });
        } else if (error.response && error.response.status >= 500) {
          updateState({ error: 'Voice service temporarily unavailable. Please try again later.' });
        } else if (error.response?.status === 404) {
          updateState({ error: 'Voice service not available. Please try again later.' });
        } else {
          updateState({ error: `Failed to start voice session (${error.response?.status || 'network error'}). Please check your connection.` });
        }
      } else {
        updateState({ error: 'Failed to start voice session. Please try again.' });
      }
      return null;
    }
  }, [updateState]);

  // Setup WebRTC peer connection - simplified with default configuration
  const setupPeerConnection = useCallback((): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // Free STUN server
      ],
    });

    // Type assertions for react-native-webrtc compatibility
    (peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        // Send ICE candidate to backend via websocket or additional API call
        console.log('ICE candidate:', event.candidate);
      }
    };

    (peerConnection as any).oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
      
      switch (peerConnection.iceConnectionState) {
        case 'connected':
        case 'completed':
          updateState({ isConnecting: false, isActive: true });
          break;
        case 'failed':
        case 'disconnected':
          updateState({ 
            isConnecting: false, 
            isActive: false, 
            error: 'Voice connection lost. Please try again.' 
          });
          break;
        case 'checking':
        case 'new':
          updateState({ isConnecting: true });
          break;
      }
    };

    (peerConnection as any).onsignalingstatechange = () => {
      console.log('Signaling state:', peerConnection.signalingState);
    };

    return peerConnection;
  }, [updateState]);

  // Start voice session - OPTIMIZED with parallel processing
  const startVoiceSession = useCallback(async (request: VoiceSessionRequest) => {
    console.log('🟡 [DEBUG] Starting OPTIMIZED voice session with request:', request);
    console.log('🟡 [DEBUG] API Base URL:', getApiBaseUrl());
    
    try {
      updateState({ isConnecting: true, error: null });

      // 🚀 OPTIMIZATION: Run these operations in PARALLEL instead of sequential
      console.log('🟡 [DEBUG] Starting parallel operations: audio permissions + session creation + WebRTC setup');
      const startTime = Date.now();
      
      const [sessionResponse, localStream, peerConnection] = await Promise.all([
        createVoiceSession(request),
        requestAudioPermissions(),
        Promise.resolve(setupPeerConnection())
      ]);

      const setupTime = Date.now() - startTime;
      console.log(`� [DEBUG] Parallel setup completed in ${setupTime}ms`);

      if (!sessionResponse || !localStream || !peerConnection) {
        console.error('🔴 [DEBUG] One of the parallel operations failed');
        updateState({ isConnecting: false });
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        return;
      }

      // Store references
      localStreamRef.current = localStream;
      sessionIdRef.current = sessionResponse.SessionId;
      peerConnectionRef.current = peerConnection;
      updateState({ sessionId: sessionResponse.SessionId });

      console.log('� [DEBUG] Voice session created, sessionId:', sessionResponse.SessionId);

      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        console.log('🟡 [DEBUG] Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, localStream);
      });

      // Create offer for voice session
      console.log('🟡 [DEBUG] Creating WebRTC offer...');
      const offerStart = Date.now();
      const offer = await peerConnection.createOffer({});
      await peerConnection.setLocalDescription(offer);
      const offerTime = Date.now() - offerStart;
      console.log(`🟢 [DEBUG] WebRTC offer created in ${offerTime}ms`);
      
      // Send offer to backend (would be handled by voice service)
      console.log('Offer SDP:', offer.sdp);

      // Mark as active
      const totalTime = Date.now() - startTime;
      updateState({ isConnecting: false, isActive: true });
      console.log(`🟢 [DEBUG] Voice session started successfully in ${totalTime}ms`);

    } catch (error) {
      console.error('🔴 [DEBUG] Failed to start voice session:', error);
      
      // Enhanced error logging
      if (axios.isAxiosError(error)) {
        console.error('🔴 [DEBUG] Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            method: error.config?.method
          }
        });
      }
      
      updateState({ 
        isConnecting: false, 
        isActive: false,
        error: `Voice session failed: ${error instanceof Error ? error.message : 'Unknown error'}. API: ${getApiBaseUrl()}voice/sessions` 
      });
      
      // Cleanup on error
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  }, [updateState, requestAudioPermissions, createVoiceSession, setupPeerConnection]);

  // Stop voice session
  const stopVoiceSession = useCallback(async () => {
    try {
      updateState({ isConnecting: false, isActive: false, isRecording: false });

      // Stop local audio stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Notify backend about session end if we have a session ID
      if (sessionIdRef.current) {
        try {
          await api.delete(`voice/session/${sessionIdRef.current}`, {
            timeout: 5000,
          });
        } catch (error) {
          console.warn('Failed to notify backend about session end:', error);
        }
        sessionIdRef.current = null;
        updateState({ sessionId: null });
      }

    } catch (error) {
      console.error('Failed to stop voice session:', error);
      updateState({ error: 'Failed to stop voice session properly.' });
    }
  }, [updateState]);

  // Reference for max duration timeout
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Callback ref to capture latest onAutoStop without stale closure
  const onAutoStopRef = useRef(recordingSafetyConfig?.onAutoStop);
  useEffect(() => {
    onAutoStopRef.current = recordingSafetyConfig?.onAutoStop;
  }, [recordingSafetyConfig?.onAutoStop]);

  // Callback ref for onVoiceResponse to avoid stale closures
  const onVoiceResponseRef = useRef(onVoiceResponse);
  useEffect(() => {
    onVoiceResponseRef.current = onVoiceResponse;
  }, [onVoiceResponse]);

  // Setup TTS callbacks for managing UX modes
  useEffect(() => {
    const voiceService = voiceAudioServiceRef.current;
    voiceService.setTTSCallbacks(
      () => {
        // TTS started
        console.log('🔊 [VOICE] TTS started callback');
        onVoiceResponseRef.current?.({
          responseText: '',
          eventType: 'tts-start',
        });
      },
      () => {
        // TTS ended
        console.log('🔊 [VOICE] TTS ended callback');
        onVoiceResponseRef.current?.({
          responseText: '',
          eventType: 'tts-end',
        });
      }
    );
  }, []);

  // Start/stop recording (for push-to-talk) - NEW: Using VoiceAudioService with parallel STT
  const setRecording = useCallback(async (recording: boolean) => {
    const voiceService = voiceAudioServiceRef.current;
    
    if (recording) {
      // Start recording audio
      try {
        console.log('🟡 [VOICE] Starting audio recording...');
        
        // Stop any ongoing TTS playback before starting new recording
        try {
          await voiceService.stopAudioPlayback();
          console.log('🟢 [VOICE] Stopped previous TTS playback (if any)');
        } catch (stopError) {
          // Ignore errors from stopping playback - it may not be playing
          console.log('🟡 [VOICE] No active playback to stop');
        }
        
        updateState({ isRecording: true, error: null });
        
        // Configure silence detection if enabled
        if (recordingSafetyConfig?.silenceThresholdDb !== undefined && 
            recordingSafetyConfig?.silenceDurationMs !== undefined) {
          voiceService.setSilenceDetection({
            silenceThresholdDb: recordingSafetyConfig.silenceThresholdDb,
            silenceDurationMs: recordingSafetyConfig.silenceDurationMs,
            onSilenceDetected: () => {
              console.log('🔇 [VOICE] Silence detected - auto-stopping recording');
              // Use a ref to avoid stale closure on the callback
              setRecordingWithAutoStop(false, 'silence');
            },
          });
        } else {
          voiceService.setSilenceDetection(null);
        }
        
        await voiceService.startRecording();
        
        // Start on-device STT simultaneously with audio recording
        // This runs in parallel and collects transcription results as user speaks
        onDeviceTranscriptionRef.current = ''; // Reset transcription
        try {
          const sttAvailable = await speechRecognitionService.checkPermissions();
          if (sttAvailable) {
            console.log('🎤 [VOICE] Starting on-device STT in parallel with recording...');
            await speechRecognitionService.startListening({
              onResult: (result: SpeechRecognitionResult) => {
                console.log('🟢 [VOICE] On-device STT result:', result.transcription);
                onDeviceTranscriptionRef.current = result.transcription;
              },
              onError: (error: string) => {
                console.log('🟡 [VOICE] On-device STT error (non-fatal):', error);
                // Non-fatal - backend STT will be used as fallback
              }
            });
          } else {
            console.log('🟡 [VOICE] On-device STT not available, will use backend STT only');
          }
        } catch (sttError) {
          console.log('🟡 [VOICE] On-device STT failed to start (non-fatal):', sttError);
          // Non-fatal - backend STT will be used as fallback
        }
        
        // Set up max duration timeout
        if (recordingSafetyConfig?.maxRecordingDurationMs) {
          console.log(`⏱️ [VOICE] Setting max recording duration: ${recordingSafetyConfig.maxRecordingDurationMs}ms`);
          maxDurationTimeoutRef.current = setTimeout(() => {
            console.log('⏰ [VOICE] Max recording duration reached - auto-stopping');
            setRecordingWithAutoStop(false, 'max-duration');
          }, recordingSafetyConfig.maxRecordingDurationMs);
        }
        
        console.log('🟢 [VOICE] Recording started successfully');
      } catch (error: any) {
        console.error('🔴 [VOICE] Failed to start recording:', error);
        
        // Check if this is a permission error - handle gracefully without showing error alert
        if (error.isPermissionError) {
          console.log('🔴 [VOICE] Permission denied - not showing error popup');
          updateState({ 
            isRecording: false, 
            error: null  // Don't set error to avoid showing alert
          });
        } else {
          updateState({ 
            isRecording: false, 
            error: error.message || 'Failed to start recording. Please check your microphone permissions.' 
          });
        }
      }
    } else {
      // Clear max duration timeout
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
        maxDurationTimeoutRef.current = null;
      }
      
      // Stop recording and process audio with PROGRESSIVE FEEDBACK
      try {
        console.log('🟡 [VOICE] Stopping recording and processing audio...');
        console.log('🟡 [VOICE] Using conversationId for context:', conversationId || '(new conversation)');
        
        // STEP 1: Immediately show user "thinking" dots (will be replaced after 3.8 seconds)
        if (onVoiceResponse) {
          onVoiceResponse({
            responseText: '🎤...',
            isUserMessage: true,
            eventType: 'transcription',
          });
        }
        
        // STEP 2: Wait a bit for on-device STT to catch up with the last ~1 second of speech
        // IMPORTANT: Wait BEFORE stopping recording to ensure full audio is captured
        console.log('🟡 [VOICE] Waiting 800ms for on-device STT to finalize...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // STEP 3: Now stop recording and send COMPLETE audio to backend
        console.log('🟡 [VOICE] Stopping recording and sending full audio to backend...');
        console.log('🎮 [VOICE] Game context to send:', gameContext || '(none)');
        const backendProcessingPromise = voiceService.stopRecordingAndProcess(conversationId || undefined, gameContext || undefined);
        
        let onDeviceTranscription = '';
        try {
          // Stop listening and get whatever transcription we have (should be more complete now)
          onDeviceTranscription = await speechRecognitionService.stopListening();
          console.log('🟢 [VOICE] On-device STT stopped with transcription:', onDeviceTranscription || '(none)');
        } catch (sttError) {
          console.log('🟡 [VOICE] Error stopping on-device STT (non-fatal):', sttError);
          // Fall back to whatever was captured in the ref
          onDeviceTranscription = onDeviceTranscriptionRef.current;
        }
        
        // Also check the ref in case the callback updated it more recently
        if (!onDeviceTranscription && onDeviceTranscriptionRef.current) {
          onDeviceTranscription = onDeviceTranscriptionRef.current;
          console.log('🟡 [VOICE] Using transcription from ref:', onDeviceTranscription);
        }
        
        // STEP 4: Wait 3 seconds before showing the transcription
        // This gives a smooth UX with a consistent delay before displaying user's text
        console.log('🟡 [VOICE] Waiting 3 seconds before displaying transcription...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // STEP 5: Show the on-device transcription in user bubble (after 3.8 seconds total)
        if (onVoiceResponse && onDeviceTranscription.trim()) {
          console.log('🟢 [VOICE] Displaying on-device transcription in user bubble:', onDeviceTranscription);
          onVoiceResponse({
            responseText: onDeviceTranscription.trim(),
            isUserMessage: true,
            eventType: 'transcription',
          });
        }
        
        // STEP 6: Show system thinking indicator immediately after user transcription
        if (onVoiceResponse) {
          console.log('🟡 [VOICE] Showing thinking indicator for AI processing');
          onVoiceResponse({
            responseText: '🤔...',
            eventType: 'thinking',
          });
        }
        
        // STEP 7: Wait for backend response
        const response = await backendProcessingPromise;
        
        console.log('🟢 [VOICE] Backend processing complete:', response);
        console.log('🟢 [VOICE] Backend transcription:', response.transcription);
        console.log('🟢 [VOICE] On-device transcription:', onDeviceTranscription);
        
        // STEP 8: Update user message with backend transcription if it's better/more complete
        // Backend processes the full audio file, so it should capture everything including the last second
        const finalTranscription = response.transcription?.trim();
        console.log('🟢 [VOICE] Backend transcription received:', finalTranscription || '(none)');
        
        // Always update with backend transcription if available (it's more accurate and complete)
        if (onVoiceResponse && finalTranscription) {
          console.log('🟢 [VOICE] Updating user bubble with complete backend transcription');
          onVoiceResponse({
            responseText: finalTranscription,
            isUserMessage: true,
            eventType: 'transcription',
          });
        }
        
        // STEP 9: Replace thinking indicator with AI response
        if (onVoiceResponse && response.responseText) {
          onVoiceResponse({
            responseText: response.responseText,
            threadId: response.conversationId,
            eventType: 'response',
          });
        }
        
        // STEP 10: Play TTS audio response (callbacks will handle UX mode changes)
        if (response.audioData) {
          console.log('🔊 [VOICE] Playing TTS audio response...');
          await voiceService.playAudioResponse(response.audioData);
          console.log('🟢 [VOICE] Audio playback complete');
        }
        
        updateState({ isRecording: false });
      } catch (error: any) {
        console.error('🔴 [VOICE] Failed to process audio:', error);
        console.error('🔴 [VOICE] Error details:', JSON.stringify(error.response?.data || error.message, null, 2));
        
        // Check if this is a "no speech recognized" error - handle gracefully without showing error
        const errorData = error.response?.data || {};
        const errorMessage = errorData.error || errorData.message || error.message || '';
        const isNoSpeechError = 
          errorMessage.toLowerCase().includes('no speech') ||
          errorMessage.toLowerCase().includes('could not be recognized') ||
          errorMessage.toLowerCase().includes('no audio') ||
          (error.response?.status === 400 && errorMessage.toLowerCase().includes('recognized'));
        
        if (isNoSpeechError) {
          console.log('🔇 [VOICE] No speech detected - showing friendly message');
          
          // Show empty user bubble (indicates voice attempted but not discernible)
          // Then show system message directly without thinking indicator
          if (onVoiceResponse) {
            // First, replace the processing indicator with empty user message
            onVoiceResponse({
              responseText: '(no speech detected)',
              isUserMessage: true,
              eventType: 'transcription',
            });
            
            // Then add the friendly system message directly (no thinking indicator)
            // Use a special event type that signals this is a direct message (no cleanup needed)
            onVoiceResponse({
              responseText: "I didn't catch that. Please tap the mic and try speaking again.",
              isUserMessage: false,
              eventType: 'direct-message', // New event type for direct system messages
            });
          }
          
          updateState({ isRecording: false });
        } else {
          // For other errors, show the error state
          // First, signal to clear any pending indicators
          if (onVoiceResponse) {
            // Send event to clear user processing indicator
            onVoiceResponse({
              responseText: '',
              isUserMessage: true,
              eventType: 'transcription',
            });
          }
          
          updateState({ 
            isRecording: false, 
            error: error.response?.data?.message || error.message || 'Failed to process voice message. Please try again.' 
          });
        }
      }
    }
  }, [updateState, onVoiceResponse, conversationId, recordingSafetyConfig]);

  // Helper function to stop recording with auto-stop reason (avoids stale closure)
  const setRecordingWithAutoStop = useCallback(async (recording: boolean, reason: 'max-duration' | 'silence') => {
    // Trigger the auto-stop callback first
    onAutoStopRef.current?.(reason);
    
    // Then stop recording
    await setRecording(recording);
  }, [setRecording]);

  // Start speech recognition
  const startSpeechRecognition = useCallback(async () => {
    try {
      console.log('🟡 [VOICE] Starting speech recognition...');
      
      const started = await speechRecognitionService.startListening({
        onResult: (result: SpeechRecognitionResult) => {
          console.log('🟢 [VOICE] Speech recognized:', result.transcription);
          // Store the transcription for when recording stops
          transcriptionRef.current = result.transcription;
        },
        onError: (error: string) => {
          console.error('🔴 [VOICE] Speech recognition error:', error);
          updateState({ error: `Speech recognition failed: ${error}` });
        }
      });

      if (!started) {
        updateState({ error: 'Could not start speech recognition. Please check your microphone permissions.' });
      }
    } catch (error) {
      console.error('🔴 [VOICE] Failed to start speech recognition:', error);
      updateState({ error: 'Speech recognition is not available on this device.' });
    }
  }, [updateState]);

  // Stop speech recognition and process the result
  const stopSpeechRecognition = useCallback(async () => {
    try {
      console.log('🟡 [VOICE] Stopping speech recognition...');
      await speechRecognitionService.stopListening();
      
      // Process the transcribed text
      processRecordedAudio();
    } catch (error) {
      console.error('🔴 [VOICE] Failed to stop speech recognition:', error);
    }
  }, []);

  // Add ref to store transcription
  const transcriptionRef = useRef<string>('');

  // Process recorded audio and send to AI
  const processRecordedAudio = useCallback(async () => {
    try {
      console.log('🟡 [DEBUG] Processing recorded audio...');
      
      const userTranscription = transcriptionRef.current;
      
      if (!userTranscription || userTranscription.trim().length === 0) {
        console.log('🟡 [VOICE] No speech detected, using fallback message');
        updateState({ error: 'No speech detected. Please try speaking more clearly.' });
        return;
      }

      console.log('🟢 [VOICE] User said:', userTranscription);
      
      // First, add the user's voice message to the chat
      if (onVoiceResponse) {
        const userMessage = {
          responseText: userTranscription,
          isUserMessage: true,
        };
        onVoiceResponse(userMessage);
      }
      
      // Send the transcription to the AI chat API for a real response
      try {
        const response = await getRecommendations({
          Query: userTranscription,
          UserId: 'voice-user', // Could be passed from ChatScreen
          ConversationId: conversationId || undefined // Use the conversation ID from hook parameter
        });

        if (response.responseText) {
          // Add the AI response to chat
          const aiResponse = {
            responseText: response.responseText,
            threadId: response.threadId
          };

          if (onVoiceResponse) {
            onVoiceResponse(aiResponse);
          }
        }
      } catch (apiError) {
        console.error('🔴 [VOICE] Failed to get AI response:', apiError);
        
        // Fallback response if API fails
        const fallbackResponse = {
          responseText: `I heard you say "${userTranscription}" but I'm having trouble processing your request right now. Please try typing your question instead.`,
        };
        
        if (onVoiceResponse) {
          onVoiceResponse(fallbackResponse);
        }
      }
      
      // Clear transcription for next recording
      transcriptionRef.current = '';
      
    } catch (error) {
      console.error('🔴 [DEBUG] Failed to process recorded audio:', error);
      updateState({ error: 'Failed to process voice recording. Please try again.' });
    }
  }, [updateState, onVoiceResponse]);

  // Stop audio playback
  const stopAudioPlayback = useCallback(async () => {
    try {
      await voiceAudioServiceRef.current.stopAudioPlayback();
      console.log('🟢 [VOICE] Audio playback stopped');
    } catch (error: any) {
      console.error('🔴 [VOICE] Failed to stop audio playback:', error);
    }
  }, []);

  // Pause TTS audio playback
  const pauseAudioPlayback = useCallback(async () => {
    try {
      await voiceAudioServiceRef.current.pauseAudioPlayback();
      console.log('🟢 [VOICE] Audio playback paused');
    } catch (error: any) {
      console.error('🔴 [VOICE] Failed to pause audio playback:', error);
    }
  }, []);

  // Resume TTS audio playback
  const resumeAudioPlayback = useCallback(async () => {
    try {
      await voiceAudioServiceRef.current.resumeAudioPlayback();
      console.log('🟢 [VOICE] Audio playback resumed');
    } catch (error: any) {
      console.error('🔴 [VOICE] Failed to resume audio playback:', error);
    }
  }, []);

  // Check if TTS is currently paused
  const isAudioPaused = useCallback(() => {
    return voiceAudioServiceRef.current.isPaused();
  }, []);

  // Check if TTS has active audio (playing or paused)
  const hasActiveAudio = useCallback(() => {
    return voiceAudioServiceRef.current.hasActiveAudio();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // Retry mechanism with exponential backoff
  const retryVoiceSession = useCallback(async (request: VoiceSessionRequest, retryCount = 0) => {
    const maxRetries = 3;
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5 seconds

    if (retryCount < maxRetries) {
      setTimeout(() => {
        console.log(`Retrying voice session (attempt ${retryCount + 1}/${maxRetries})`);
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
    stopAudioPlayback,
    pauseAudioPlayback,
    resumeAudioPlayback,
    clearError,
    retryVoiceSession,
    
    // Utilities
    isSupported: !!(mediaDevices && RTCPeerConnection),
    isAudioPaused,
    hasActiveAudio,
  };
};