import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream } from 'react-native-webrtc';
import axios from 'axios';

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

// Environment-specific API base URLs
const getApiBaseUrl = (): string => {
  // TEMPORARY: Force dev endpoint for voice testing until prod is configured
  // TODO: Remove this when production voice service is deployed
  return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
  
  // Original logic (restored after production voice service is deployed):
  // Check if we're in a development environment
  // if (__DEV__) {
  //   // For development, use Azure Front Door endpoint
  //   return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
  // }
  // 
  // // For production, use Azure Front Door endpoint
  // return 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

export const useVoiceSession = () => {
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
        timeout: 10000, // 10 second timeout
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

  // Start voice session - simplified for free-form input/output
  const startVoiceSession = useCallback(async (request: VoiceSessionRequest) => {
    console.log('🟡 [DEBUG] Starting voice session with request:', request);
    console.log('🟡 [DEBUG] API Base URL:', getApiBaseUrl());
    console.log('🟡 [DEBUG] Environment __DEV__:', __DEV__);
    console.log('🟡 [DEBUG] Platform:', Platform.OS);
    
    try {
      updateState({ isConnecting: true, error: null });

      // Request audio permissions
      const localStream = await requestAudioPermissions();
      if (!localStream) {
        updateState({ isConnecting: false });
        return;
      }
      localStreamRef.current = localStream;

      // Create voice session with backend
      console.log('🟡 [DEBUG] Creating voice session via API...');
      const sessionResponse = await createVoiceSession(request);
      if (!sessionResponse) {
        updateState({ isConnecting: false });
        localStream.getTracks().forEach(track => track.stop());
        return;
      }

      console.log('🟢 [DEBUG] Voice session created, sessionId:', sessionResponse.SessionId);
      sessionIdRef.current = sessionResponse.SessionId;
      updateState({ sessionId: sessionResponse.SessionId });

      // Setup peer connection with default configuration
      console.log('🟡 [DEBUG] Setting up WebRTC peer connection...');
      const peerConnection = setupPeerConnection();
      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        console.log('🟡 [DEBUG] Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, localStream);
      });

      // Create offer for simplified voice session
      console.log('🟡 [DEBUG] Creating WebRTC offer...');
      const offer = await peerConnection.createOffer({});
      await peerConnection.setLocalDescription(offer);
      console.log('🟢 [DEBUG] WebRTC offer created and local description set');
      
      // Send offer to backend (would be handled by voice service)
      console.log('Offer SDP:', offer.sdp);

      // Mark as active for simplified testing
      updateState({ isConnecting: false, isActive: true });
      console.log('🟢 [DEBUG] Voice session started successfully');

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

  // Start/stop recording (for push-to-talk)
  const setRecording = useCallback((recording: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = recording;
      });
      updateState({ isRecording: recording });
    }
  }, [updateState]);

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
    clearError,
    retryVoiceSession,
    
    // Utilities
    isSupported: !!(mediaDevices && RTCPeerConnection),
  };
};