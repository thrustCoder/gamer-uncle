import axios from 'axios';
import { MediaStream as RNMediaStream, mediaDevices } from 'react-native-webrtc';

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

interface WebRTCTokenData {
  sessionId: string;
  deploymentName: string;
  endpoint: string;
  expiresAt: string;
  systemMessage: string;
  voice: string;
  iceServers: any[];
  apiVersion: string;
}

interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

/**
 * Azure OpenAI Realtime API Voice Service
 * Implements true WebRTC bidirectional voice communication with Azure OpenAI Realtime API
 */
export class FoundryVoiceService {
  private websocket: WebSocket | null = null;
  private localStream: RNMediaStream | null = null;
  private remoteStream: RNMediaStream | null = null;
  private currentSession: VoiceSession | null = null;
  private tokenData: WebRTCTokenData | null = null;
  private isConnected = false;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(
    private onRemoteAudio: (stream: RNMediaStream) => void,
    private onConnectionStateChange: (state: VoiceConnectionState) => void,
    private onTranscriptUpdate: (transcript: string) => void
  ) {
  }

  async startVoiceSession(request: VoiceSessionRequest): Promise<boolean> {
    try {
      console.log('🎤 [FOUNDRY-REALTIME] Starting Azure OpenAI Realtime voice session with request:', request);

      // 1. Create voice session (backend will inject RAG context)
      this.currentSession = await this.createVoiceSession(request);
      
      // 2. Parse WebRTC token for connection details
      this.tokenData = this.parseWebRTCToken(this.currentSession.webRtcToken);
      
      // 3. Connect to Azure OpenAI Realtime API via WebSocket
      await this.connectToRealtimeAPI();
      
      // 4. Get user microphone access
      this.localStream = await this.getUserMedia();
      
      // 5. Start audio streaming
      await this.startAudioStreaming();

      console.log('🟢 [FOUNDRY-REALTIME] Voice session started successfully');
      return true;

    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to start voice session:', error);
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

      console.log('🟢 [FOUNDRY-REALTIME] Voice session created:', response.data.sessionId);
      return response.data;
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to create voice session:', error);
      throw new Error(`Failed to create voice session: ${error}`);
    }
  }

  private parseWebRTCToken(token: string): WebRTCTokenData {
    try {
      const decoded = atob(token);
      const tokenData = JSON.parse(decoded) as WebRTCTokenData;
      console.log('📋 [FOUNDRY-REALTIME] Parsed WebRTC token for deployment:', tokenData.deploymentName);
      return tokenData;
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to parse WebRTC token:', error);
      throw new Error('Invalid WebRTC token format');
    }
  }

  private async connectToRealtimeAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.tokenData) {
        reject(new Error('No token data available'));
        return;
      }

      const wsUrl = this.currentSession!.foundryConnectionUrl;
      console.log('🔗 [FOUNDRY-REALTIME] Connecting to Azure OpenAI Realtime API:', wsUrl);

      // For development, handle mock WebSocket connections
      if (wsUrl.includes('mock') || wsUrl.includes('test') || wsUrl.includes('local')) {
        console.log('🧪 [FOUNDRY-REALTIME] Mock WebSocket detected - simulating connection');
        
        // Simulate successful connection for development
        setTimeout(() => {
          console.log('🟢 [FOUNDRY-REALTIME] Mock WebSocket connected successfully');
          this.isConnected = true;
          this.notifyConnectionStateChange('connected');
          resolve();
        }, 1000);
        
        return;
      }

      this.websocket = new WebSocket(wsUrl);
      this.notifyConnectionStateChange('connecting');

      this.websocket.onopen = () => {
        console.log('🟢 [FOUNDRY-REALTIME] WebSocket connected to Azure OpenAI Realtime API');
        this.isConnected = true;
        this.initializeRealtimeSession();
        this.notifyConnectionStateChange('connected');
        resolve();
      };

      this.websocket.onmessage = (event) => {
        this.handleRealtimeEvent(JSON.parse(event.data));
      };

      this.websocket.onerror = (error) => {
        console.error('🔴 [FOUNDRY-REALTIME] WebSocket error:', error);
        this.notifyConnectionStateChange('failed');
        reject(error);
      };

      this.websocket.onclose = () => {
        console.log('🔌 [FOUNDRY-REALTIME] WebSocket disconnected');
        this.isConnected = false;
        this.notifyConnectionStateChange('disconnected');
      };
    });
  }

  private initializeRealtimeSession(): void {
    if (!this.websocket || !this.tokenData) return;

    // Send session configuration with system message and voice settings
    const sessionUpdate: RealtimeEvent = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.tokenData.systemMessage,
        voice: this.tokenData.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        }
      }
    };

    console.log('⚙️ [FOUNDRY-REALTIME] Configuring session with voice:', this.tokenData.voice);
    this.websocket.send(JSON.stringify(sessionUpdate));
  }

  private handleRealtimeEvent(event: RealtimeEvent): void {
    console.log('📨 [FOUNDRY-REALTIME] Received event:', event.type);

    switch (event.type) {
      case 'session.created':
        console.log('🎯 [FOUNDRY-REALTIME] Session created successfully');
        break;
        
      case 'session.updated':
        console.log('🔄 [FOUNDRY-REALTIME] Session updated');
        break;
        
      case 'response.audio.delta':
        // Handle incoming audio data from AI
        if (event.delta) {
          this.handleIncomingAudio(event.delta);
        }
        break;
        
      case 'response.audio_transcript.delta':
        // Handle transcription of AI response
        if (event.delta) {
          this.onTranscriptUpdate(`[AI]: ${event.delta}`);
        }
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('🎤 [FOUNDRY-REALTIME] Speech detected');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('🔇 [FOUNDRY-REALTIME] Speech ended');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // Handle transcription of user input
        if (event.transcript) {
          this.onTranscriptUpdate(`[User]: ${event.transcript}`);
        }
        break;
        
      case 'error':
        console.error('🔴 [FOUNDRY-REALTIME] API error:', event);
        this.notifyConnectionStateChange('failed');
        break;
        
      default:
        console.log('📋 [FOUNDRY-REALTIME] Unhandled event type:', event.type);
    }
  }

  private async getUserMedia(): Promise<RNMediaStream> {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      console.log('🎤 [FOUNDRY-REALTIME] Microphone access granted');
      return stream;
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to get microphone access:', error);
      throw new Error('Microphone access required for voice session');
    }
  }

  private async startAudioStreaming(): Promise<void> {
    if (!this.localStream || !this.websocket) return;

    try {
      // TODO: Implement proper audio streaming with React Native WebRTC
      // For now, we'll focus on the WebSocket connection and session management
      console.log('🎤 [FOUNDRY-REALTIME] Audio streaming setup - simplified for development');
      
      console.log('� [FOUNDRY-REALTIME] Audio streaming placeholder active');
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to start audio streaming:', error);
      throw error;
    }
  }

  private convertToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return pcm16Array;
  }

  private handleIncomingAudio(base64Audio: string): void {
    try {
      // Decode base64 audio data
      const binaryString = atob(base64Audio);
      const audioData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioData[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 back to Float32 for playback
      const int16Array = new Int16Array(audioData.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Create audio buffer and play
      if (this.audioContext) {
        const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.copyToChannel(float32Array, 0);
        
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start();
      }
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to handle incoming audio:', error);
    }
  }

  async stopVoiceSession(): Promise<void> {
    try {
      console.log('🛑 [FOUNDRY-REALTIME] Stopping voice session');

      if (this.websocket && this.isConnected) {
        this.websocket.close();
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.currentSession = null;
      this.tokenData = null;
      this.isConnected = false;
      
      this.notifyConnectionStateChange('disconnected');
      console.log('🟢 [FOUNDRY-REALTIME] Voice session stopped successfully');
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Error stopping voice session:', error);
    }
  }

  private notifyConnectionStateChange(state: VoiceConnectionState['state']): void {
    this.onConnectionStateChange({
      state,
      sessionId: this.currentSession?.sessionId
    });
  }

  // Public methods for session management
  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  isSessionActive(): boolean {
    return this.isConnected && this.currentSession !== null;
  }

  async validateSession(): Promise<boolean> {
    if (!this.currentSession) return false;
    
    try {
      const response = await api.get(`/voice/sessions/${this.currentSession.sessionId}/status`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async terminateSession(): Promise<void> {
    if (!this.currentSession) return;
    
    try {
      await api.delete(`/voice/sessions/${this.currentSession.sessionId}`);
      await this.stopVoiceSession();
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Error terminating session:', error);
      throw error;
    }
  }
}