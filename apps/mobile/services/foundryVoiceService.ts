import axios from 'axios';
import { MediaStream as RNMediaStream, mediaDevices } from 'react-native-webrtc';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  pcm16ToWav,
  arrayBufferToBase64,
  decodeBase64PCM16,
  concatenateAudioBuffers,
  extractPCM16FromWav,
  encodePCM16ToBase64
} from './audioUtils';

// Environment-specific API base URLs
const getApiBaseUrl = (): string => {
  // For development testing with local API - use host machine IP for iOS simulator
  if (__DEV__) {
    // Use local API when developing locally
    return 'http://192.168.50.11:5001/api/'; // Local API (host machine IP for iOS simulator)
    // return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/'; // Azure endpoint
  }
  return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000, // 30 second timeout to match backend expectations
  headers: {
    'Content-Type': 'application/json',
  },
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
  recentMessages?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
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
  accessToken: string;
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
  private isRecording = false;
  
  // Audio playback properties
  private audioBufferQueue: ArrayBuffer[] = [];
  private soundObject: Audio.Sound | null = null;
  private aiTranscriptBuffer = '';
  private isPlayingAudio = false;
  private audioInterrupted = false; // Flag to prevent playing new chunks after interruption
  
  // Audio capture properties
  private recording: Audio.Recording | null = null;
  private audioPermissionsGranted = false;

  constructor(
    private onRemoteAudio: (stream: RNMediaStream) => void,
    private onConnectionStateChange: (state: VoiceConnectionState) => void,
    private onTranscriptUpdate: (transcript: string) => void
  ) {
  }

  async startVoiceSession(request: VoiceSessionRequest): Promise<boolean> {
    try {
      const sessionStartTime = Date.now();
      console.log('🎤 [FOUNDRY-REALTIME] Starting Azure OpenAI Realtime voice session with request:', request);
      console.log('⏱️ [TIMING] Session start time:', new Date().toISOString());

      // Reset audio interruption flag for new session
      this.audioInterrupted = false;

      // 1. Create voice session (backend will inject RAG context)
      console.log('⏱️ [TIMING] Step 1: Creating voice session via backend API...');
      const step1Start = Date.now();
      this.currentSession = await this.createVoiceSession(request);
      const step1Time = Date.now() - step1Start;
      console.log(`⏱️ [TIMING] Step 1 completed in ${step1Time}ms - Voice session created`);
      
      // 2. Parse WebRTC token for connection details
      console.log('⏱️ [TIMING] Step 2: Parsing WebRTC token...');
      const step2Start = Date.now();
      this.tokenData = this.parseWebRTCToken(this.currentSession.webRtcToken);
      const step2Time = Date.now() - step2Start;
      console.log(`⏱️ [TIMING] Step 2 completed in ${step2Time}ms - Token parsed`);
      
      // 3. Connect to Azure OpenAI Realtime API via WebSocket
      console.log('⏱️ [TIMING] Step 3: Connecting to Azure OpenAI Realtime API...');
      const step3Start = Date.now();
      await this.connectToRealtimeAPI();
      const step3Time = Date.now() - step3Start;
      console.log(`⏱️ [TIMING] Step 3 completed in ${step3Time}ms - WebSocket connected`);
      
      // 4. Get user microphone access
      console.log('⏱️ [TIMING] Step 4: Getting user microphone access...');
      const step4Start = Date.now();
      this.localStream = await this.getUserMedia();
      const step4Time = Date.now() - step4Start;
      console.log(`⏱️ [TIMING] Step 4 completed in ${step4Time}ms - Microphone access granted`);
      
      // 5. Start audio streaming
      console.log('⏱️ [TIMING] Step 5: Starting audio streaming...');
      const step5Start = Date.now();
      await this.startAudioStreaming();
      const step5Time = Date.now() - step5Start;
      console.log(`⏱️ [TIMING] Step 5 completed in ${step5Time}ms - Audio streaming started`);

      const totalTime = Date.now() - sessionStartTime;
      console.log(`🟢 [FOUNDRY-REALTIME] Voice session started successfully`);
      console.log(`⏱️ [TIMING] TOTAL SESSION STARTUP TIME: ${totalTime}ms`);
      console.log(`⏱️ [TIMING] Breakdown: API=${step1Time}ms, Parse=${step2Time}ms, WebSocket=${step3Time}ms, Mic=${step4Time}ms, Stream=${step5Time}ms`);
      return true;

    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to start voice session:', error);
      this.notifyConnectionStateChange('failed');
      return false;
    }
  }

  private async createVoiceSession(request: VoiceSessionRequest): Promise<VoiceSession> {
    try {
      console.log('🌐 [API-TIMING] Making HTTP POST request to:', api.defaults.baseURL + 'voice/sessions');
      console.log('🌐 [API-TIMING] Request payload:', request);
      console.log('🌐 [API-TIMING] Request start time:', new Date().toISOString());
      
      const apiStartTime = Date.now();
      const response = await api.post<VoiceSession>('/voice/sessions', request);
      const apiEndTime = Date.now();
      const apiDuration = apiEndTime - apiStartTime;
      
      console.log(`🌐 [API-TIMING] HTTP request completed in ${apiDuration}ms`);
      console.log('🌐 [API-TIMING] Response status:', response.status);
      console.log('🌐 [API-TIMING] Response data:', response.data);
      
      if (!response.data.sessionId) {
        throw new Error('Invalid voice session response');
      }

      console.log('🟢 [FOUNDRY-REALTIME] Voice session created:', response.data.sessionId);
      return response.data;
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to create voice session:', error);
      
      // Enhanced error logging
      if ((error as any).code === 'ECONNABORTED') {
        console.error('🔴 [API-TIMING] Request timed out after 30 seconds');
      } else if ((error as any).response) {
        console.error('🔴 [API-TIMING] Server responded with error:', {
          status: (error as any).response.status,
          statusText: (error as any).response.statusText,
          data: (error as any).response.data
        });
      } else if ((error as any).request) {
        console.error('🔴 [API-TIMING] No response received:', (error as any).request);
        console.error('🔴 [API-TIMING] Network error or server unreachable');
      } else {
        console.error('🔴 [API-TIMING] Request setup error:', (error as any).message);
      }
      
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
      console.log('🔗 [WS-TIMING] WebSocket connection start time:', new Date().toISOString());
      
      const wsConnectStartTime = Date.now();

      // For development, handle mock WebSocket connections
      if (wsUrl.includes('mock') || wsUrl.includes('test') || wsUrl.includes('local')) {
        console.log('🧪 [FOUNDRY-REALTIME] Mock WebSocket detected - simulating connection');
        
        // Simulate successful connection for development
        setTimeout(() => {
          const mockConnectTime = Date.now() - wsConnectStartTime;
          console.log(`🟢 [FOUNDRY-REALTIME] Mock WebSocket connected successfully in ${mockConnectTime}ms`);
          this.isConnected = true;
          this.notifyConnectionStateChange('connected');
          resolve();
        }, 1000);
        
        return;
      }

      this.websocket = new WebSocket(wsUrl);
      this.notifyConnectionStateChange('connecting');

      this.websocket.onopen = () => {
        const wsConnectTime = Date.now() - wsConnectStartTime;
        console.log(`🟢 [FOUNDRY-REALTIME] WebSocket connected to Azure OpenAI Realtime API in ${wsConnectTime}ms`);
        console.log('🔗 [WS-TIMING] WebSocket connection established time:', new Date().toISOString());
        this.isConnected = true;
        this.initializeRealtimeSession();
        this.notifyConnectionStateChange('connected');
        resolve();
      };

      this.websocket.onmessage = (event) => {
        this.handleRealtimeEvent(JSON.parse(event.data));
      };

      this.websocket.onerror = (error) => {
        const wsErrorTime = Date.now() - wsConnectStartTime;
        console.error(`🔴 [FOUNDRY-REALTIME] WebSocket error after ${wsErrorTime}ms:`, error);
        console.error('🔗 [WS-TIMING] WebSocket error time:', new Date().toISOString());
        this.notifyConnectionStateChange('failed');
        reject(error);
      };

      this.websocket.onclose = () => {
        const wsCloseTime = Date.now() - wsConnectStartTime;
        console.log(`🔌 [FOUNDRY-REALTIME] WebSocket disconnected after ${wsCloseTime}ms`);
        console.log('🔗 [WS-TIMING] WebSocket close time:', new Date().toISOString());
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
          model: 'whisper-1',
          language: 'en' // Force English transcription
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
        // Buffer AI response transcript deltas
        if (event.delta) {
          this.aiTranscriptBuffer += event.delta;
          console.log('📝 [FOUNDRY-REALTIME] AI transcript delta buffered:', event.delta);
        }
        break;

      case 'response.done':
        console.log('✅ [FOUNDRY-REALTIME] AI response completed');
        // Show complete buffered transcript
        if (this.aiTranscriptBuffer) {
          this.onTranscriptUpdate(`[AI]: ${this.aiTranscriptBuffer}`);
          this.aiTranscriptBuffer = ''; // Clear buffer for next response
        }
        break;

      case 'response.audio_transcript.done':
        // AI response transcript completed
        console.log('📝 [FOUNDRY-REALTIME] AI response transcript completed');
        break;

      case 'response.created':
        console.log('🚀 [FOUNDRY-REALTIME] AI response generation started');
        // Clear transcript buffer for new response
        this.aiTranscriptBuffer = '';
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
        // Only treat certain errors as fatal
        // Some errors are transient or recoverable (e.g., turn detection issues)
        const errorCode = event.error?.code || event.code;
        const isFatalError = errorCode === 'session_expired' || 
                            errorCode === 'invalid_session' || 
                            errorCode === 'authentication_failed';
        
        if (isFatalError) {
          console.error('🔴 [FOUNDRY-REALTIME] Fatal error - marking connection as failed');
          this.notifyConnectionStateChange('failed');
        } else {
          console.warn('⚠️ [FOUNDRY-REALTIME] Non-fatal error - continuing session');
        }
        break;
        
      default:
        console.log('📋 [FOUNDRY-REALTIME] Unhandled event type:', event.type);
    }
  }

  private async getUserMedia(): Promise<RNMediaStream> {
    try {
      console.log('🎤 [MIC-TIMING] Requesting microphone access...');
      const micStartTime = Date.now();
      
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      const micAccessTime = Date.now() - micStartTime;
      console.log(`🎤 [FOUNDRY-REALTIME] Microphone access granted in ${micAccessTime}ms`);
      console.log('🎤 [MIC-TIMING] Microphone access time:', new Date().toISOString());
      return stream;
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to get microphone access:', error);
      console.error('🎤 [MIC-TIMING] Microphone access failed time:', new Date().toISOString());
      throw new Error('Microphone access required for voice session');
    }
  }

  private async startAudioStreaming(): Promise<void> {
    if (!this.localStream || !this.websocket) return;

    try {
      console.log('🎵 [STREAM-TIMING] Starting audio capture setup...');
      const streamStartTime = Date.now();
      
      // Request audio recording permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        throw new Error('Audio recording permission not granted');
      }
      
      this.audioPermissionsGranted = true;
      console.log('✅ [FOUNDRY-REALTIME] Audio permissions granted');
      
      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
      
      const streamSetupTime = Date.now() - streamStartTime;
      console.log(`🎵 [FOUNDRY-REALTIME] Audio capture ready in ${streamSetupTime}ms`);
      console.log('🎵 [STREAM-TIMING] Audio streaming time:', new Date().toISOString());
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to start audio streaming:', error);
      console.error('🎵 [STREAM-TIMING] Audio streaming failed time:', new Date().toISOString());
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

  private async handleIncomingAudio(base64Audio: string): Promise<void> {
    try {
      // Don't process new audio if we've been interrupted
      if (this.audioInterrupted) {
        console.log('⏭️ [FOUNDRY-REALTIME] Skipping audio delta - playback interrupted');
        return;
      }
      
      console.log('🔊 [FOUNDRY-REALTIME] Received audio delta, size:', base64Audio.length);
      
      // Decode base64 to PCM16 binary data
      const pcm16Data = decodeBase64PCM16(base64Audio);
      
      // Queue the audio buffer for playback
      this.audioBufferQueue.push(pcm16Data.buffer as ArrayBuffer);
      
      // Start playback if not already playing
      if (!this.isPlayingAudio) {
        await this.playAudioQueue();
      }
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to handle incoming audio:', error);
    }
  }

  private async playAudioQueue(): Promise<void> {
    // Don't play if interrupted
    if (this.audioBufferQueue.length === 0 || this.isPlayingAudio || this.audioInterrupted) {
      return;
    }

    try {
      this.isPlayingAudio = true;
      console.log('🎵 [FOUNDRY-REALTIME] Playing audio queue with', this.audioBufferQueue.length, 'chunks');

      // Concatenate all queued audio buffers
      const concatenated = concatenateAudioBuffers(this.audioBufferQueue);
      this.audioBufferQueue = [];

      // Convert PCM16 to WAV format
      const wavBuffer = pcm16ToWav(concatenated, 24000, 1);
      const base64Wav = arrayBufferToBase64(wavBuffer);
      const uri = `data:audio/wav;base64,${base64Wav}`;

      // Configure audio mode for playback
      // IMPORTANT: Keep allowsRecordingIOS: true to prevent audio ducking
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, // Changed from false to prevent ducking
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });

      // Play the audio using expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      this.soundObject = sound;

      // Set up playback completion handler
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('✅ [FOUNDRY-REALTIME] Audio playback finished');
          sound.unloadAsync();
          this.soundObject = null;
          this.isPlayingAudio = false;

          // Play next chunk if available and not interrupted
          if (this.audioBufferQueue.length > 0 && !this.audioInterrupted) {
            this.playAudioQueue();
          }
        }
      });

      console.log('🎵 [FOUNDRY-REALTIME] Audio playback started');
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to play audio:', error);
      this.isPlayingAudio = false;
      this.soundObject = null;
    }
  }

  /**
   * Stop audio playback immediately (interrupt TTS)
   * Used when user wants to interrupt AI's response
   */
  async stopAudioPlayback(): Promise<void> {
    try {
      console.log('⏸️ [FOUNDRY-REALTIME] Interrupting audio playback');

      // Set interruption flag to prevent new chunks from playing
      this.audioInterrupted = true;

      // Stop current sound playback
      if (this.soundObject) {
        await this.soundObject.stopAsync();
        await this.soundObject.unloadAsync();
        this.soundObject = null;
      }

      // Clear audio queue to prevent playing queued chunks
      this.audioBufferQueue = [];
      this.isPlayingAudio = false;

      console.log('🟢 [FOUNDRY-REALTIME] Audio playback interrupted successfully');
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Error stopping audio playback:', error);
    }
  }

  /**
   * Check if AI is currently speaking (playing TTS audio)
   */
  isAISpeaking(): boolean {
    return this.isPlayingAudio || this.audioBufferQueue.length > 0;
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

      // Clean up audio playback
      if (this.soundObject) {
        await this.soundObject.unloadAsync();
        this.soundObject = null;
      }
      this.audioBufferQueue = [];
      this.aiTranscriptBuffer = '';
      this.isPlayingAudio = false;

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

  // Push-to-talk controls for Azure OpenAI Realtime API
  async setRecording(recording: boolean): Promise<void> {
    if (!this.audioPermissionsGranted) {
      console.warn('🔴 [FOUNDRY-REALTIME] Cannot set recording - no audio permissions');
      return;
    }

    console.log(`🎤 [FOUNDRY-REALTIME] Setting recording state to: ${recording}`);
    
    if (recording) {
      // Start recording audio
      await this.startRecording();
    } else {
      // Stop recording and send audio to Azure
      await this.stopRecordingAndSend();
    }
    
    this.isRecording = recording;
    
    // Notify connection state change to update UI
    this.notifyConnectionStateChange(this.isConnected ? 'connected' : 'disconnected');
  }

  private async startRecording(): Promise<void> {
    try {
      console.log('🎤 [FOUNDRY-REALTIME] Starting audio recording...');
      
      // Reset audio interruption flag when starting new recording
      this.audioInterrupted = false;
      
      // Create new recording
      this.recording = new Audio.Recording();
      
      // Prepare to record with high quality WAV PCM16 settings
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: 0, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm', // Linear PCM
          audioQuality: 127, // MAX quality
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000
        }
      });
      
      // Start recording
      await this.recording.startAsync();
      console.log('🎤 [FOUNDRY-REALTIME] Recording started');
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to start recording:', error);
      this.recording = null;
    }
  }

  private async stopRecordingAndSend(): Promise<void> {
    if (!this.recording) {
      console.warn('🔴 [FOUNDRY-REALTIME] No active recording to stop');
      return;
    }

    try {
      console.log('🛑 [FOUNDRY-REALTIME] Stopping recording and sending to Azure...');
      
      // Stop recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      if (!uri) {
        console.error('🔴 [FOUNDRY-REALTIME] No recording URI available');
        this.recording = null;
        return;
      }

      console.log('📁 [FOUNDRY-REALTIME] Recording saved to:', uri);
      
      // Read the WAV file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64'
      });

      // Convert base64 to binary to extract PCM16 data
      const wavData = decodeBase64PCM16(base64Audio);
      
      // Extract PCM16 data (skip 44-byte WAV header)
      const pcm16Data = extractPCM16FromWav(wavData);
      
      // Encode PCM16 to base64 for WebSocket transmission
      const pcm16Base64 = encodePCM16ToBase64(pcm16Data);

      console.log(`📤 [FOUNDRY-REALTIME] Sending ${pcm16Data.length} bytes of PCM16 audio to Azure`);

      // Send to Azure via WebSocket
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: pcm16Base64
        }));

        // Trigger AI response generation
        console.log('🚀 [FOUNDRY-REALTIME] Triggering AI response generation');
        this.websocket.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: 'Please respond to the user\'s input. Keep responses conversational and helpful.'
          }
        }));
      } else {
        console.error('🔴 [FOUNDRY-REALTIME] WebSocket not ready to send audio');
      }

      // Clean up
      this.recording = null;
      
      // Delete the temporary file
      await FileSystem.deleteAsync(uri, { idempotent: true });
      console.log('✅ [FOUNDRY-REALTIME] Audio sent and temp file cleaned up');
      
    } catch (error) {
      console.error('🔴 [FOUNDRY-REALTIME] Failed to stop recording and send:', error);
      this.recording = null;
    }
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }
}