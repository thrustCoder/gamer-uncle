import Voice from '@react-native-voice/voice';

// Type the voice handlers to be captured during setup
type VoiceHandlers = {
  onSpeechStart?: () => void;
  onSpeechRecognized?: () => void;
  onSpeechEnd?: () => void;
  onSpeechError?: (error: any) => void;
  onSpeechResults?: (event: any) => void;
  onSpeechPartialResults?: (event: any) => void;
};

// Capture Voice event handlers for test triggering
const voiceHandlers: VoiceHandlers = {};

// Mock @react-native-voice/voice
jest.mock('@react-native-voice/voice', () => ({
  isAvailable: jest.fn(() => Promise.resolve(true)),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  cancel: jest.fn(() => Promise.resolve()),
  removeAllListeners: jest.fn(),
  // Capture handlers when they're set
  set onSpeechStart(handler: () => void) { voiceHandlers.onSpeechStart = handler; },
  set onSpeechRecognized(handler: () => void) { voiceHandlers.onSpeechRecognized = handler; },
  set onSpeechEnd(handler: () => void) { voiceHandlers.onSpeechEnd = handler; },
  set onSpeechError(handler: (error: any) => void) { voiceHandlers.onSpeechError = handler; },
  set onSpeechResults(handler: (event: any) => void) { voiceHandlers.onSpeechResults = handler; },
  set onSpeechPartialResults(handler: (event: any) => void) { voiceHandlers.onSpeechPartialResults = handler; },
}));

// Import after mock setup
import { speechRecognitionService, SpeechRecognitionService, SpeechRecognitionResult } from '../services/speechRecognitionService';

describe('SpeechRecognitionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset handlers
    Object.keys(voiceHandlers).forEach(key => {
      delete voiceHandlers[key as keyof VoiceHandlers];
    });
    // Re-create service to get fresh handlers
    // Force re-instantiation
    (SpeechRecognitionService as any).instance = undefined;
  });

  describe('startListening', () => {
    it('should start speech recognition successfully', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      const result = await service.startListening({ onResult, onError });

      expect(result).toBe(true);
      expect(Voice.isAvailable).toHaveBeenCalled();
      expect(Voice.start).toHaveBeenCalledWith('en-US', expect.any(Object));
    });

    it('should return false when voice is not available', async () => {
      (Voice.isAvailable as jest.Mock).mockResolvedValueOnce(false);
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      const result = await service.startListening({ onResult, onError });

      expect(result).toBe(false);
      expect(onError).toHaveBeenCalledWith('Speech recognition is not available on this device');
    });

    it('should stop existing listening session before starting new one', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      // Start first session
      await service.startListening({ onResult, onError });
      // Start second session
      await service.startListening({ onResult, onError });

      expect(Voice.stop).toHaveBeenCalled();
    });
  });

  describe('stopListening - final result handling', () => {
    it('should return the final transcription from onSpeechResults', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Simulate final speech results arriving
      voiceHandlers.onSpeechResults?.({ value: ['thank you gamer uncle you\'re awesome'] });

      const result = await service.stopListening();

      expect(result).toBe('thank you gamer uncle you\'re awesome');
    });

    it('should wait for final results if not yet received', async () => {
      jest.useFakeTimers();
      
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Simulate partial results (not final)
      voiceHandlers.onSpeechPartialResults?.({ value: ['thank you gamer uncle'] });

      // Start stopping - this will create a promise waiting for final results
      const stopPromise = service.stopListening();

      // Simulate final results arriving after stop is called
      voiceHandlers.onSpeechResults?.({ value: ['thank you gamer uncle you\'re awesome'] });

      const result = await stopPromise;

      expect(result).toBe('thank you gamer uncle you\'re awesome');
      
      jest.useRealTimers();
    });

    it('should timeout and return partial results if final results never arrive', async () => {
      jest.useFakeTimers();
      
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Simulate only partial results (no final)
      voiceHandlers.onSpeechPartialResults?.({ value: ['thank you gamer'] });

      // Start stopping
      const stopPromise = service.stopListening();

      // Advance timers past the timeout (500ms)
      jest.advanceTimersByTime(600);

      const result = await stopPromise;

      expect(result).toBe('thank you gamer');
      
      jest.useRealTimers();
    });

    it('should resolve on speech end if no final results', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Simulate partial results
      voiceHandlers.onSpeechPartialResults?.({ value: ['hello world'] });

      // Start stopping
      const stopPromise = service.stopListening();

      // Simulate speech end without final results
      voiceHandlers.onSpeechEnd?.();

      const result = await stopPromise;

      expect(result).toBe('hello world');
    });
  });

  describe('partial results handling', () => {
    it('should update transcription with partial results', async () => {
      const service = SpeechRecognitionService.getInstance();
      const results: SpeechRecognitionResult[] = [];
      const onResult = (result: SpeechRecognitionResult) => results.push(result);
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Simulate progressive partial results
      voiceHandlers.onSpeechPartialResults?.({ value: ['thank'] });
      voiceHandlers.onSpeechPartialResults?.({ value: ['thank you'] });
      voiceHandlers.onSpeechPartialResults?.({ value: ['thank you gamer'] });

      expect(results.length).toBe(3);
      expect(results[0].transcription).toBe('thank');
      expect(results[1].transcription).toBe('thank you');
      expect(results[2].transcription).toBe('thank you gamer');
      expect(results[2].isFinal).toBe(false);
    });

    it('should mark final results as isFinal', async () => {
      const service = SpeechRecognitionService.getInstance();
      const results: SpeechRecognitionResult[] = [];
      const onResult = (result: SpeechRecognitionResult) => results.push(result);
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Simulate final speech results
      voiceHandlers.onSpeechResults?.({ value: ['final transcription'] });

      expect(results.length).toBe(1);
      expect(results[0].transcription).toBe('final transcription');
      expect(results[0].isFinal).toBe(true);
    });
  });

  describe('getLatestTranscription', () => {
    it('should return the latest transcription without stopping', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      voiceHandlers.onSpeechPartialResults?.({ value: ['current partial'] });

      const latest = service.getLatestTranscription();

      expect(latest).toBe('current partial');
      expect(service.isCurrentlyListening()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should resolve with latest transcription on error', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      await service.startListening({ onResult, onError });

      // Set some partial results
      voiceHandlers.onSpeechPartialResults?.({ value: ['partial before error'] });

      // Start stopping
      const stopPromise = service.stopListening();

      // Simulate error
      voiceHandlers.onSpeechError?.({ error: { message: 'Recognition failed' } });

      const result = await stopPromise;

      expect(result).toBe('partial before error');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SpeechRecognitionService.getInstance();
      const instance2 = SpeechRecognitionService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
