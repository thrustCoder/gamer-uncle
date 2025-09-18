import axios from 'axios';
import { MediaStream } from 'react-native-webrtc';

// Environment-specific API base URLs
const getApiBaseUrl = (): string => {
  return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

export interface VoiceSession {
  sessionId: string;
  foundryConnectionUrl: string;
  webRtcToken: string;
  expiresAt: string;
  conversationId?: string;
}

export interface VoiceSessionRequest {
  query: string;
  conversationId?: string;
  userId?: string;
}

export interface VoiceConnectionState {
  state: 'disconnected' | 'connecting' | 'connected' | 'failed';
  sessionId?: string;
}

export class FoundryVoiceService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentSession: VoiceSession | null = null;
  private websocket: WebSocket | null = null;

  constructor(
    private onRemoteAudio: (stream: MediaStream) => void,
    private onConnectionStateChange: (state: VoiceConnectionState) => void
  ) {
  }

  async startVoiceSession(request: VoiceSessionRequest): Promise<boolean> {
    try {
      console.log('🎤 [FOUNDRY] Starting voice session with request:', request);

      // 1. Create voice session (backend will inject RAG context)
      this.currentSession = await this.createVoiceSession(request);
      
      // 2. Set up WebRTC connection to Foundry
      await this.setupWebRTCConnection();
      
      // 3. Get user microphone access
      this.localStream = await this.getUserMedia();
      
      // 4. Add audio track to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getAudioTracks().forEach(track => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // 5. Connect to Foundry Live Voice
      await this.connectToFoundry();

      console.log('🟢 [FOUNDRY] Voice session started successfully');
      return true;

    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to start voice session:', error);
      this.notifyConnectionStateChange('failed');
      return false;
    }
  }

  private async createVoiceSession(request: VoiceSessionRequest): Promise<VoiceSession> {
    try {
      const response = await api.post<VoiceSession>('/voice/sessions', request);
      
      if (!response.data.sessionId) {
        throw new Error('Invalid voice session response');
      }

      console.log('🟢 [FOUNDRY] Voice session created:', response.data.sessionId);
      return response.data;
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to create voice session:', error);
      throw new Error(`Failed to create voice session: ${error}`);
    }
  }

  private async setupWebRTCConnection(): Promise<void> {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Handle incoming audio stream from Foundry
    this.peerConnection.ontrack = (event) => {
      console.log('🎵 [FOUNDRY] Received remote audio track from Foundry');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteAudio(this.remoteStream);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log(`🔗 [FOUNDRY] Connection state: ${state}`);
      
      switch (state) {
        case 'connected':
          this.notifyConnectionStateChange('connected');
          break;
        case 'disconnected':
        case 'failed':
          this.notifyConnectionStateChange('failed');
          break;
        case 'connecting':
          this.notifyConnectionStateChange('connecting');
          break;
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          sessionId: this.currentSession?.sessionId
        }));
      }
    };
  }

  private async getUserMedia(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimize for voice
        }
      });
      
      console.log('🎤 [FOUNDRY] Microphone access granted');
      return stream;
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to get user media:', error);
      throw new Error('Microphone access denied. Please grant microphone permissions.');
    }
  }

  private async connectToFoundry(): Promise<void> {
    if (!this.currentSession || !this.peerConnection) {
      throw new Error('Session or peer connection not initialized');
    }

    this.notifyConnectionStateChange('connecting');

    // Create WebSocket connection to Foundry Live Voice
    this.websocket = new WebSocket(this.currentSession.foundryConnectionUrl);
    
    this.websocket.onopen = async () => {
      console.log('🔗 [FOUNDRY] WebSocket connected to Foundry Live Voice');
      
      try {
        // Send authentication with WebRTC token
        this.websocket!.send(JSON.stringify({
          type: 'auth',
          token: this.currentSession!.webRtcToken,
          sessionId: this.currentSession!.sessionId
        }));

        // Create and send offer
        const offer = await this.peerConnection!.createOffer({
          offerToReceiveAudio: true
        });
        
        await this.peerConnection!.setLocalDescription(offer);
        
        this.websocket!.send(JSON.stringify({
          type: 'offer',
          sdp: offer,
          sessionId: this.currentSession!.sessionId
        }));
      } catch (error) {
        console.error('🔴 [FOUNDRY] Error during WebSocket setup:', error);
        this.notifyConnectionStateChange('failed');
      }
    };

    this.websocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleFoundryMessage(message);
      } catch (error) {
        console.error('🔴 [FOUNDRY] Error handling WebSocket message:', error);
      }
    };

    this.websocket.onerror = (error) => {
      console.error('🔴 [FOUNDRY] WebSocket error:', error);
      this.notifyConnectionStateChange('failed');
    };

    this.websocket.onclose = (event) => {
      console.log('🔗 [FOUNDRY] WebSocket connection closed:', event.code, event.reason);
      if (this.currentSession) {
        this.notifyConnectionStateChange('disconnected');
      }
    };
  }

  private async handleFoundryMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'answer':
        if (this.peerConnection && message.sdp) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
          console.log('🟢 [FOUNDRY] SDP answer received and set');
        }
        break;

      case 'ice-candidate':
        if (this.peerConnection && message.candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
          console.log('🟢 [FOUNDRY] ICE candidate added');
        }
        break;

      case 'session-ready':
        console.log('🟢 [FOUNDRY] Foundry Live Voice session ready for conversation');
        break;

      case 'error':
        console.error('🔴 [FOUNDRY] Session error:', message.error);
        this.notifyConnectionStateChange('failed');
        break;

      default:
        console.log('🔍 [FOUNDRY] Unknown message type:', message.type);
    }
  }

  private notifyConnectionStateChange(state: VoiceConnectionState['state']) {
    this.onConnectionStateChange({
      state,
      sessionId: this.currentSession?.sessionId
    });
  }

  async endVoiceSession(): Promise<void> {
    try {
      console.log('🔄 [FOUNDRY] Ending voice session');

      // Close WebRTC connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Close WebSocket
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
          console.log('🔄 [FOUNDRY] Stopped audio track:', track.kind);
        });
        this.localStream = null;
      }

      // End session on backend
      if (this.currentSession) {
        try {
          await api.delete(`/voice/sessions/${this.currentSession.sessionId}`);
          console.log('🟢 [FOUNDRY] Session terminated on backend');
        } catch (error) {
          console.warn('🟡 [FOUNDRY] Failed to terminate session on backend:', error);
        }
        this.currentSession = null;
      }

      this.notifyConnectionStateChange('disconnected');
      console.log('🟢 [FOUNDRY] Voice session ended successfully');
    } catch (error) {
      console.error('🔴 [FOUNDRY] Error ending voice session:', error);
    }
  }

  isActive(): boolean {
    return this.currentSession !== null && 
           this.peerConnection?.connectionState === 'connected';
  }

  getSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }

  getCurrentConnectionState(): VoiceConnectionState['state'] {
    if (!this.currentSession) return 'disconnected';
    
    switch (this.peerConnection?.connectionState) {
      case 'connected': return 'connected';
      case 'connecting': return 'connecting';
      case 'failed': return 'failed';
      default: return 'disconnected';
    }
  }
}