import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import axios from 'axios';
import { getAppKey } from '../config/apiConfig';

export interface AudioProcessingRequest {
  audioData: string; // Base64
  format: 'Wav' | 'Pcm16';
  conversationId?: string;
  gameContext?: string; // Optional game context from GameSetup screen
}

export interface AudioProcessingResponse {
  transcription: string;
  responseText: string;
  audioData: string; // Base64 TTS audio
  conversationId: string;
}

export interface SilenceDetectionConfig {
  silenceThresholdDb: number;  // dB level below which is considered silence (e.g., -40)
  silenceDurationMs: number;   // How long silence must persist before triggering (e.g., 10000ms)
  onSilenceDetected?: () => void;
}

export class VoiceAudioService {
  private recording: Audio.Recording | null = null;
  private soundObject: Audio.Sound | null = null;
  private apiBaseUrl: string;
  private appKey: string;
  private isPausedState: boolean = false;
  
  // TTS state callbacks
  private onTTSStartCallback?: () => void;
  private onTTSEndCallback?: () => void;
  
  // Silence detection state
  private silenceConfig: SilenceDetectionConfig | null = null;
  private meteringInterval: NodeJS.Timeout | null = null;
  private silenceStartTime: number | null = null;

  constructor(apiBaseUrl: string, appKey?: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.appKey = appKey || getAppKey();
  }

  /**
   * Set TTS state callbacks
   */
  setTTSCallbacks(onStart?: () => void, onEnd?: () => void): void {
    this.onTTSStartCallback = onStart;
    this.onTTSEndCallback = onEnd;
  }

  /**
   * Configure silence detection (call before startRecording)
   */
  setSilenceDetection(config: SilenceDetectionConfig | null): void {
    this.silenceConfig = config;
  }

  /**
   * Start recording audio from microphone
   */
  async startRecording(): Promise<void> {
    console.log('🎤 [AUDIO] Requesting audio permissions...');
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      // Throw a specific error that can be handled gracefully
      const error = new Error('Audio permission not granted');
      (error as any).isPermissionError = true;
      throw error;
    }

    console.log('🎤 [AUDIO] Setting audio mode for recording...');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    console.log('🎤 [AUDIO] Preparing to record...');
    this.recording = new Audio.Recording();
    
    // Configure recording options for PCM16 format
    await this.recording.prepareToRecordAsync({
      isMeteringEnabled: true,
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 24000,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 24000,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/wav',
        bitsPerSecond: 128000,
      },
    });

    await this.recording.startAsync();
    console.log('🟢 [AUDIO] Recording started');

    // Start silence detection monitoring if configured
    if (this.silenceConfig) {
      this.startSilenceDetection();
    }
  }

  /**
   * Start monitoring audio levels for silence detection
   */
  private startSilenceDetection(): void {
    if (!this.silenceConfig || !this.recording) return;

    console.log('🔇 [AUDIO] Starting silence detection monitoring...');
    this.silenceStartTime = null;

    // Check audio levels every 200ms
    this.meteringInterval = setInterval(async () => {
      if (!this.recording || !this.silenceConfig) {
        this.stopSilenceDetection();
        return;
      }

      try {
        const status = await this.recording.getStatusAsync();
        if (!status.isRecording) {
          this.stopSilenceDetection();
          return;
        }

        // metering is the audio level in dB (typically -160 to 0)
        const meteringDb = status.metering ?? -160;
        
        // Check if current level is below silence threshold
        if (meteringDb < this.silenceConfig.silenceThresholdDb) {
          // Audio is silent
          if (this.silenceStartTime === null) {
            this.silenceStartTime = Date.now();
            console.log('🔇 [AUDIO] Silence started at', meteringDb, 'dB');
          } else {
            const silenceDuration = Date.now() - this.silenceStartTime;
            if (silenceDuration >= this.silenceConfig.silenceDurationMs) {
              console.log(`🔇 [AUDIO] Silence detected for ${silenceDuration}ms - triggering callback`);
              this.stopSilenceDetection();
              this.silenceConfig.onSilenceDetected?.();
              return;
            }
          }
        } else {
          // Audio detected, reset silence timer
          if (this.silenceStartTime !== null) {
            console.log('🔊 [AUDIO] Audio detected at', meteringDb, 'dB - resetting silence timer');
          }
          this.silenceStartTime = null;
        }
      } catch (error) {
        console.warn('⚠️ [AUDIO] Error checking metering:', error);
      }
    }, 200);
  }

  /**
   * Stop silence detection monitoring
   */
  private stopSilenceDetection(): void {
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }
    this.silenceStartTime = null;
  }

  /**
   * Stop recording and send audio to backend for processing
   * @param conversationId - Optional conversation ID for context
   * @param gameContext - Optional game context from GameSetup screen
   */
  async stopRecordingAndProcess(conversationId?: string, gameContext?: string): Promise<AudioProcessingResponse> {
    // Stop silence detection first
    this.stopSilenceDetection();

    if (!this.recording) {
      throw new Error('No active recording');
    }

    console.log('🎤 [AUDIO] Stopping recording...');
    console.log('🎤 [AUDIO] Game context:', gameContext || '(none)');
    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    if (!uri) {
      throw new Error('No recording URI');
    }

    console.log('🎤 [AUDIO] Recording URI:', uri);

    try {
      // Read WAV file as base64 using new v19 API
      console.log('🎤 [AUDIO] Reading recorded audio file...');
      const audioFile = new File(uri);
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = this.arrayBufferToBase64(arrayBuffer);

      console.log(`🎤 [AUDIO] Audio file size: ${base64Audio.length} characters (base64)`);

      // Send full WAV file to backend (backend will strip header if needed)
      console.log('🌐 [AUDIO] Sending audio to backend for processing...');
      const response = await axios.post<AudioProcessingResponse>(
        `${this.apiBaseUrl}voice/process`,
        {
          audioData: base64Audio,
          format: 'Wav',
          conversationId,
          gameContext,
        } as AudioProcessingRequest,
        {
          timeout: 45000, // 45 second timeout for audio processing
          headers: {
            'Content-Type': 'application/json',
            'X-GamerUncle-AppKey': this.appKey,
          },
        }
      );

      console.log('🟢 [AUDIO] Backend processing complete');
      console.log(`📝 Transcription: "${response.data.transcription}"`);
      console.log(`🤖 Response: "${response.data.responseText}"`);

      return response.data;
    } finally {
      // Clean up recording
      this.recording = null;
      
      // Delete temporary file using new v19 API
      try {
        const audioFile = new File(uri);
        await audioFile.delete();
      } catch (error) {
        console.warn('⚠️ [AUDIO] Failed to delete temporary recording:', error);
      }
    }
  }

  // Track temp file URI for cleanup
  private tempAudioFileUri: string | null = null;

  /**
   * Check if device needs temp file workaround for audio playback.
   * Data URIs can cause AVPlayerItem error -16041 on older iOS versions (iOS 16.x and below).
   * iOS 17+ handles data URIs properly, so we use the more elegant approach there.
   */
  private needsTempFileWorkaround(): boolean {
    if (Platform.OS !== 'ios') {
      return false; // Only iOS has this issue
    }
    
    // Parse iOS version - Platform.Version is a string like "16.7.2" on iOS
    const iosVersion = typeof Platform.Version === 'string' 
      ? parseFloat(Platform.Version) 
      : Platform.Version;
    
    // iOS 16.x and below need the temp file workaround
    const needsWorkaround = iosVersion < 17;
    
    if (needsWorkaround) {
      console.log(`📱 [AUDIO] iOS ${Platform.Version} detected - using temp file for audio playback compatibility`);
    }
    
    return needsWorkaround;
  }

  /**
   * Play TTS audio response from backend
   */
  async playAudioResponse(base64Audio: string): Promise<void> {
    console.log('🔊 [AUDIO] Preparing to play TTS audio response...');

    // Convert base64 to WAV (backend returns raw PCM16, we need to add WAV header)
    const wavData = this.pcm16ToWav(base64Audio);
    const base64Wav = this.arrayBufferToBase64(wavData);
    
    console.log('🔊 [AUDIO] Setting audio mode for playback...');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Determine audio source based on device compatibility
    let audioUri: string;
    
    if (this.needsTempFileWorkaround()) {
      // Older iOS: Write to temp file to avoid AVPlayerItem error -16041
      console.log('🔊 [AUDIO] Writing audio to temp file for playback (legacy iOS compatibility)...');
      const tempFileName = `tts_audio_${Date.now()}.wav`;
      const tempFilePath = `${Paths.cache}/${tempFileName}`;
      
      const audioBytes = this.base64ToUint8Array(base64Wav);
      const tempFile = new File(tempFilePath);
      await tempFile.write(audioBytes);
      this.tempAudioFileUri = tempFilePath;
      audioUri = tempFilePath;
    } else {
      // Modern devices: Use data URI for elegant in-memory playback
      console.log('🔊 [AUDIO] Loading audio from data URI...');
      audioUri = `data:audio/wav;base64,${base64Wav}`;
    }
    
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 },
        this.onPlaybackStatusUpdate
      );

      this.soundObject = sound;
      this.isPausedState = false;
      console.log('🟢 [AUDIO] Playing TTS audio...');
      
      // Notify TTS started
      this.onTTSStartCallback?.();

      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            if (status.error) {
              console.error('🔴 [AUDIO] Playback error:', status.error);
              this.cleanupTempAudioFile();
              this.onTTSEndCallback?.();
              reject(new Error(`Playback error: ${status.error}`));
            }
            return;
          }

          if (status.didJustFinish) {
            console.log('🟢 [AUDIO] Playback finished');
            sound.unloadAsync();
            this.soundObject = null;
            this.isPausedState = false;
            this.cleanupTempAudioFile();
            // Notify TTS ended
            this.onTTSEndCallback?.();
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('🔴 [AUDIO] Failed to prepare audio playback:', error);
      this.cleanupTempAudioFile();
      throw error;
    }
  }

  /**
   * Clean up temporary audio file used for TTS playback
   */
  private async cleanupTempAudioFile(): Promise<void> {
    if (this.tempAudioFileUri) {
      try {
        const tempFile = new File(this.tempAudioFileUri);
        await tempFile.delete();
        console.log('🧹 [AUDIO] Cleaned up temp audio file');
      } catch (error) {
        console.warn('⚠️ [AUDIO] Failed to delete temp audio file:', error);
      }
      this.tempAudioFileUri = null;
    }
  }

  /**
   * Stop audio playback (interrupt AI response)
   */
  async stopAudioPlayback(): Promise<void> {
    if (this.soundObject) {
      console.log('🛑 [AUDIO] Stopping playback...');
      await this.soundObject.stopAsync();
      await this.soundObject.unloadAsync();
      this.soundObject = null;
      this.isPausedState = false;
      await this.cleanupTempAudioFile();
      // Notify TTS ended (interrupted)
      this.onTTSEndCallback?.();
    }
  }

  /**
   * Pause audio playback
   */
  async pauseAudioPlayback(): Promise<void> {
    if (this.soundObject && !this.isPausedState) {
      console.log('⏸️ [AUDIO] Pausing playback...');
      await this.soundObject.pauseAsync();
      this.isPausedState = true;
      console.log('🟢 [AUDIO] Playback paused');
    }
  }

  /**
   * Resume audio playback
   */
  async resumeAudioPlayback(): Promise<void> {
    if (this.soundObject && this.isPausedState) {
      console.log('▶️ [AUDIO] Resuming playback...');
      await this.soundObject.playAsync();
      this.isPausedState = false;
      console.log('🟢 [AUDIO] Playback resumed');
    }
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.soundObject !== null && !this.isPausedState;
  }

  /**
   * Check if audio is paused
   */
  isPaused(): boolean {
    return this.soundObject !== null && this.isPausedState;
  }

  /**
   * Check if audio is loaded (playing or paused)
   */
  hasActiveAudio(): boolean {
    return this.soundObject !== null;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop silence detection
    this.stopSilenceDetection();

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.warn('⚠️ [AUDIO] Error stopping recording during cleanup:', error);
      }
      this.recording = null;
    }

    if (this.soundObject) {
      try {
        await this.soundObject.unloadAsync();
      } catch (error) {
        console.warn('⚠️ [AUDIO] Error unloading sound during cleanup:', error);
      }
      this.soundObject = null;
    }

    // Clean up temp audio file
    await this.cleanupTempAudioFile();
  }

  // ========== Helper Methods ==========

  /**
   * Callback for playback status updates
   */
  private onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded && status.isPlaying) {
      // Log playback progress (optional, for debugging)
      // console.log(`🔊 [AUDIO] Playback position: ${status.positionMillis}ms / ${status.durationMillis}ms`);
    }
  };

  /**
   * Convert PCM16 data to WAV format with proper header
   */
  private pcm16ToWav(base64Pcm: string): ArrayBuffer {
    // Decode base64 to binary
    const pcmData = this.base64ToUint8Array(base64Pcm);
    
    // Create WAV header (44 bytes)
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true); // File size - 8
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true); // NumChannels (1 = mono)
    view.setUint32(24, 24000, true); // SampleRate (24kHz)
    view.setUint32(28, 48000, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16-bit)

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true); // Subchunk2Size (data size)

    // Combine header and PCM data
    const wavFile = new Uint8Array(44 + pcmData.length);
    wavFile.set(new Uint8Array(wavHeader), 0);
    wavFile.set(pcmData, 44);

    return wavFile.buffer;
  }

  /**
   * Write ASCII string to DataView
   */
  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Singleton instance for use across the app
let voiceAudioServiceInstance: VoiceAudioService | null = null;

export const getVoiceAudioService = (apiBaseUrl: string): VoiceAudioService => {
  if (!voiceAudioServiceInstance) {
    voiceAudioServiceInstance = new VoiceAudioService(apiBaseUrl);
  }
  return voiceAudioServiceInstance;
};
