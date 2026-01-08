import Voice from '@react-native-voice/voice';
import { Platform } from 'react-native';

export interface SpeechRecognitionResult {
  transcription: string;
  confidence: number;
  isFinal?: boolean;
}

export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService;
  private isListening = false;
  private onResult?: (result: SpeechRecognitionResult) => void;
  private onError?: (error: string) => void;
  
  // Track the latest transcription and whether we've received final results
  private latestTranscription: string = '';
  private hasFinalResult: boolean = false;
  private finalResultResolver?: (transcription: string) => void;
  private finalResultTimeout?: NodeJS.Timeout;

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
      
      // When speech ends, resolve with the latest transcription if we have a pending resolver
      // This handles the case where final results come after stop is called
      if (this.finalResultResolver && this.latestTranscription) {
        console.log('🟢 [SPEECH] Resolving with transcription on speech end:', this.latestTranscription);
        this.finalResultResolver(this.latestTranscription);
        this.finalResultResolver = undefined;
      }
    };

    Voice.onSpeechError = (error: any) => {
      console.error('🔴 [SPEECH] Speech recognition error:', error);
      this.isListening = false;
      const errorMessage = error?.error?.message || 'Speech recognition failed';
      this.onError?.(errorMessage);
      
      // Resolve with whatever we have on error
      if (this.finalResultResolver) {
        this.finalResultResolver(this.latestTranscription);
        this.finalResultResolver = undefined;
      }
    };

    Voice.onSpeechResults = (event: any) => {
      console.log('🟢 [SPEECH] Speech results (FINAL):', event.value);
      if (event.value && event.value.length > 0) {
        const transcription = event.value[0];
        const confidence = 0.9; // Voice API doesn't provide confidence scores
        
        // Store as the latest (and final) transcription
        this.latestTranscription = transcription;
        this.hasFinalResult = true;
        
        this.onResult?.({
          transcription,
          confidence,
          isFinal: true
        });
        
        // If we have a pending resolver waiting for final results, resolve it now
        if (this.finalResultResolver) {
          console.log('🟢 [SPEECH] Resolving pending final result:', transcription);
          this.finalResultResolver(transcription);
          this.finalResultResolver = undefined;
          if (this.finalResultTimeout) {
            clearTimeout(this.finalResultTimeout);
            this.finalResultTimeout = undefined;
          }
        }
      }
    };

    Voice.onSpeechPartialResults = (event: any) => {
      console.log('🟡 [SPEECH] Partial results:', event.value);
      // Store partial results as they come in (these update progressively)
      if (event.value && event.value.length > 0) {
        this.latestTranscription = event.value[0];
        
        // Notify callback with partial results
        this.onResult?.({
          transcription: this.latestTranscription,
          confidence: 0.7, // Lower confidence for partial results
          isFinal: false
        });
      }
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
      
      // Reset transcription state for new session
      this.latestTranscription = '';
      this.hasFinalResult = false;
      this.finalResultResolver = undefined;
      if (this.finalResultTimeout) {
        clearTimeout(this.finalResultTimeout);
        this.finalResultTimeout = undefined;
      }

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

  /**
   * Stop speech recognition and wait for final transcription result.
   * Returns a promise that resolves with the final transcription.
   */
  async stopListening(): Promise<string> {
    try {
      if (this.isListening) {
        console.log('🟡 [SPEECH] Stopping speech recognition and waiting for final result...');
        
        // Create a promise that will be resolved when we get the final result
        const finalResultPromise = new Promise<string>((resolve) => {
          // If we already have a final result, resolve immediately
          if (this.hasFinalResult && this.latestTranscription) {
            console.log('🟢 [SPEECH] Already have final result:', this.latestTranscription);
            resolve(this.latestTranscription);
            return;
          }
          
          // Otherwise, set up resolver to be called when final result arrives
          this.finalResultResolver = resolve;
          
          // Set a timeout to avoid waiting forever (500ms should be enough for final results)
          this.finalResultTimeout = setTimeout(() => {
            console.log('🟡 [SPEECH] Final result timeout, using latest transcription:', this.latestTranscription);
            if (this.finalResultResolver) {
              this.finalResultResolver(this.latestTranscription);
              this.finalResultResolver = undefined;
            }
          }, 500);
        });
        
        // Stop Voice recognition - this triggers onSpeechEnd and potentially final onSpeechResults
        await Voice.stop();
        this.isListening = false;
        
        // Wait for the final result
        const finalTranscription = await finalResultPromise;
        console.log('🟢 [SPEECH] Speech recognition stopped with final result:', finalTranscription);
        
        return finalTranscription;
      }
      
      // Not listening, return whatever we have
      return this.latestTranscription;
    } catch (error) {
      console.error('🔴 [SPEECH] Failed to stop speech recognition:', error);
      this.isListening = false;
      return this.latestTranscription;
    }
  }

  /**
   * Get the latest transcription without stopping
   */
  getLatestTranscription(): string {
    return this.latestTranscription;
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
      // Voice.isAvailable() can return boolean true/false OR number 1/0 depending on platform
      // Use truthy check to handle both cases
      const available = Boolean(isAvailable);
      console.log('🟡 [SPEECH] Voice availability check:', { isAvailable, available });
      return available;
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