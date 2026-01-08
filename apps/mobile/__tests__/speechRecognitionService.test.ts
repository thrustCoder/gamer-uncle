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
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset handlers
    Object.keys(voiceHandlers).forEach(key => {
      delete voiceHandlers[key as keyof VoiceHandlers];
    });
    
    // Reset service instance to force re-instantiation
    (SpeechRecognitionService as any).instance = undefined;
    
    // Re-mock Voice methods to ensure they're fresh
    (Voice.start as jest.Mock).mockClear();
    (Voice.stop as jest.Mock).mockClear();
    (Voice.cancel as jest.Mock).mockClear();
    (Voice.isAvailable as jest.Mock).mockResolvedValue(true);
    (Voice.start as jest.Mock).mockResolvedValue(undefined);
    (Voice.stop as jest.Mock).mockResolvedValue(undefined);
    (Voice.cancel as jest.Mock).mockResolvedValue(undefined);
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

  describe('checkPermissions', () => {
    it('should return true when voice is available', async () => {
      (Voice.isAvailable as jest.Mock).mockResolvedValue(true);
      const service = SpeechRecognitionService.getInstance();

      const available = await service.checkPermissions();

      expect(available).toBe(true);
      expect(Voice.isAvailable).toHaveBeenCalled();
    });

    it('should return false when voice is not available', async () => {
      (Voice.isAvailable as jest.Mock).mockResolvedValue(false);
      const service = SpeechRecognitionService.getInstance();

      const available = await service.checkPermissions();

      expect(available).toBe(false);
    });

    it('should handle numeric return values from isAvailable', async () => {
      // Some platforms return 1/0 instead of true/false
      (Voice.isAvailable as jest.Mock).mockResolvedValue(1);
      const service = SpeechRecognitionService.getInstance();

      const available = await service.checkPermissions();

      expect(available).toBe(true);
    });

    it('should handle zero numeric value as false', async () => {
      (Voice.isAvailable as jest.Mock).mockResolvedValue(0);
      const service = SpeechRecognitionService.getInstance();

      const available = await service.checkPermissions();

      expect(available).toBe(false);
    });

    it('should return false on exception', async () => {
      (Voice.isAvailable as jest.Mock).mockRejectedValue(new Error('Check failed'));
      const service = SpeechRecognitionService.getInstance();

      const available = await service.checkPermissions();

      expect(available).toBe(false);
    });
  });

  describe('cancelListening', () => {
    it('should cancel active listening session', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      await service.cancelListening();

      expect(Voice.cancel).toHaveBeenCalled();
      expect(service.isCurrentlyListening()).toBe(false);
    });

    it('should not throw when cancelling without active session', async () => {
      const service = SpeechRecognitionService.getInstance();

      await expect(service.cancelListening()).resolves.not.toThrow();
    });

    it('should handle cancel errors gracefully', async () => {
      (Voice.cancel as jest.Mock).mockRejectedValue(new Error('Cancel failed'));
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      await service.cancelListening();

      // Should set isListening to false even on error
      expect(service.isCurrentlyListening()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove all voice listeners', () => {
      const service = SpeechRecognitionService.getInstance();

      service.cleanup();

      expect(Voice.removeAllListeners).toHaveBeenCalled();
    });

    it('should stop active listening on cleanup', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      service.cleanup();

      // Should stop any active listening
      expect(service.isCurrentlyListening()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty partial results', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      await service.startListening({ onResult, onError: jest.fn() });

      voiceHandlers.onSpeechPartialResults?.({ value: [] });

      // Should not crash
      expect(onResult).not.toHaveBeenCalled();
    });

    it('should handle null partial results', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      await service.startListening({ onResult, onError: jest.fn() });

      voiceHandlers.onSpeechPartialResults?.({ value: null });

      // Should not crash
      expect(onResult).not.toHaveBeenCalled();
    });

    it('should handle empty final results', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      await service.startListening({ onResult, onError: jest.fn() });

      voiceHandlers.onSpeechResults?.({ value: [] });

      // Should not crash
      expect(onResult).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid start/stop cycles', async () => {
      const service = SpeechRecognitionService.getInstance();
      const onResult = jest.fn();
      const onError = jest.fn();

      // Rapid start/stop cycles
      for (let i = 0; i < 5; i++) {
        await service.startListening({ onResult, onError });
        await service.stopListening();
      }

      // Should not crash and final state should be consistent
      expect(service.isCurrentlyListening()).toBe(false);
    });

    it('should handle concurrent stop calls', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      // Call stop multiple times concurrently
      const promises = [
        service.stopListening(),
        service.stopListening(),
        service.stopListening(),
      ];

      await Promise.all(promises);

      // Should handle gracefully
      expect(service.isCurrentlyListening()).toBe(false);
    });

    it('should handle error with no error callback', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn() } as any);

      // Trigger error without callback
      voiceHandlers.onSpeechError?.({ error: { message: 'Test error' } });

      // Should not crash
      expect(service.isCurrentlyListening()).toBe(false);
    });

    it('should handle result with no result callback', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onError: jest.fn() } as any);

      // Trigger result without callback
      voiceHandlers.onSpeechResults?.({ value: ['test'] });

      // Should not crash
    });

    it('should track transcription from mixed partial and final results', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      // Partial results come in
      voiceHandlers.onSpeechPartialResults?.({ value: ['hello'] });
      expect(service.getLatestTranscription()).toBe('hello');

      voiceHandlers.onSpeechPartialResults?.({ value: ['hello world'] });
      expect(service.getLatestTranscription()).toBe('hello world');

      // Final results override
      voiceHandlers.onSpeechResults?.({ value: ['hello world!'] });
      expect(service.getLatestTranscription()).toBe('hello world!');
    });

    it('should clear transcription when starting new session', async () => {
      const service = SpeechRecognitionService.getInstance();
      
      // First session
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });
      voiceHandlers.onSpeechResults?.({ value: ['first session'] });
      await service.stopListening();

      // Second session
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });
      
      // Transcription should be cleared
      const transcription = service.getLatestTranscription();
      expect(transcription).toBe('');
    });
  });

  describe('platform-specific behavior', () => {
    it('should pass language code to voice start', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      expect(Voice.start).toHaveBeenCalledWith(
        'en-US',
        expect.objectContaining({
          locale: 'en-US',
          maxResults: 1,
          partialResults: true,
        })
      );
    });

    it('should configure partial results for streaming transcription', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      expect(Voice.start).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          partialResults: true,
        })
      );
    });

    it('should limit max results to avoid memory issues', async () => {
      const service = SpeechRecognitionService.getInstance();
      await service.startListening({ onResult: jest.fn(), onError: jest.fn() });

      expect(Voice.start).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxResults: 1,
        })
      );
    });
  });
});
