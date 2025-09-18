import Voice from '@react-native-voice/voice';
import { Platform } from 'react-native';

export interface SpeechRecognitionResult {
  transcription: string;
  confidence: number;
}

export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService;
  private isListening = false;
  private onResult?: (result: SpeechRecognitionResult) => void;
  private onError?: (error: string) => void;

  static getInstance(): SpeechRecognitionService {
    if (!SpeechRecognitionService.instance) {
      SpeechRecognitionService.instance = new SpeechRecognitionService();
    }
    return SpeechRecognitionService.instance;
  }

  constructor() {
    this.setupVoiceListeners();
  }

  private setupVoiceListeners() {
    Voice.onSpeechStart = () => {
      console.log('🟡 [SPEECH] Speech recognition started');
    };

    Voice.onSpeechRecognized = () => {
      console.log('🟡 [SPEECH] Speech recognized');
    };

    Voice.onSpeechEnd = () => {
      console.log('🟡 [SPEECH] Speech recognition ended');
      this.isListening = false;
    };

    Voice.onSpeechError = (error: any) => {
      console.error('🔴 [SPEECH] Speech recognition error:', error);
      this.isListening = false;
      const errorMessage = error?.error?.message || 'Speech recognition failed';
      this.onError?.(errorMessage);
    };

    Voice.onSpeechResults = (event: any) => {
      console.log('🟢 [SPEECH] Speech results:', event.value);
      if (event.value && event.value.length > 0) {
        const transcription = event.value[0];
        const confidence = 0.9; // Voice API doesn't provide confidence scores
        
        this.onResult?.({
          transcription,
          confidence
        });
      }
    };

    Voice.onSpeechPartialResults = (event: any) => {
      console.log('🟡 [SPEECH] Partial results:', event.value);
    };
  }

  async startListening(options?: {
    onResult: (result: SpeechRecognitionResult) => void;
    onError: (error: string) => void;
  }): Promise<boolean> {
    try {
      if (this.isListening) {
        console.log('🟡 [SPEECH] Already listening, stopping first...');
        await this.stopListening();
      }

      this.onResult = options?.onResult;
      this.onError = options?.onError;

      console.log('🟡 [SPEECH] Starting speech recognition...');
      
      const isAvailable = await Voice.isAvailable();
      if (!isAvailable) {
        const error = 'Speech recognition is not available on this device';
        console.error('🔴 [SPEECH]', error);
        this.onError?.(error);
        return false;
      }

      // Configure speech recognition options
      const voiceOptions = {
        locale: 'en-US', // English (US)
        maxResults: 1,
        partialResults: true,
        ...(Platform.OS === 'android' && {
          RECOGNIZER_ENGINE: 'GOOGLE',
        }),
      };

      await Voice.start(voiceOptions.locale, voiceOptions);
      this.isListening = true;
      console.log('🟢 [SPEECH] Speech recognition started successfully');
      return true;

    } catch (error) {
      console.error('🔴 [SPEECH] Failed to start speech recognition:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start speech recognition';
      this.onError?.(errorMessage);
      return false;
    }
  }

  async stopListening(): Promise<void> {
    try {
      if (this.isListening) {
        console.log('🟡 [SPEECH] Stopping speech recognition...');
        await Voice.stop();
        this.isListening = false;
        console.log('🟢 [SPEECH] Speech recognition stopped');
      }
    } catch (error) {
      console.error('🔴 [SPEECH] Failed to stop speech recognition:', error);
      this.isListening = false;
    }
  }

  async cancelListening(): Promise<void> {
    try {
      if (this.isListening) {
        console.log('🟡 [SPEECH] Cancelling speech recognition...');
        await Voice.cancel();
        this.isListening = false;
        console.log('🟢 [SPEECH] Speech recognition cancelled');
      }
    } catch (error) {
      console.error('🔴 [SPEECH] Failed to cancel speech recognition:', error);
      this.isListening = false;
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const isAvailable = await Voice.isAvailable();
      return isAvailable === 1; // Voice.isAvailable() returns 1 for true, 0 for false
    } catch (error) {
      console.error('🔴 [SPEECH] Failed to check speech permissions:', error);
      return false;
    }
  }

  cleanup(): void {
    this.stopListening();
    Voice.removeAllListeners();
  }
}

export const speechRecognitionService = SpeechRecognitionService.getInstance();