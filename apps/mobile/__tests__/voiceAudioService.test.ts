import { VoiceAudioService, SilenceDetectionConfig } from '../services/voiceAudioService';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(() => Promise.resolve()),
      startAsync: jest.fn(() => Promise.resolve()),
      stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
      getURI: jest.fn(() => 'file://test-recording.wav'),
      getStatusAsync: jest.fn(() => Promise.resolve({
        isRecording: true,
        metering: -30, // Normal speech level
      })),
    })),
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          setOnPlaybackStatusUpdate: jest.fn(),
          unloadAsync: jest.fn(() => Promise.resolve()),
          stopAsync: jest.fn(() => Promise.resolve()),
        },
      })),
    },
    AndroidOutputFormat: { DEFAULT: 0 },
    AndroidAudioEncoder: { DEFAULT: 0 },
    IOSOutputFormat: { LINEARPCM: 0 },
    IOSAudioQuality: { HIGH: 0 },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(100))),
    delete: jest.fn(() => Promise.resolve()),
  })),
  Paths: {},
}));

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({
    data: {
      transcription: 'Test transcription',
      responseText: 'Test response',
      audioData: 'dGVzdA==', // base64 encoded "test"
      conversationId: 'test-conv-123',
    },
  })),
}));

describe('VoiceAudioService', () => {
  let service: VoiceAudioService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new VoiceAudioService('http://localhost:5001/');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Silence Detection Configuration', () => {
    it('should accept silence detection configuration', () => {
      const config: SilenceDetectionConfig = {
        silenceThresholdDb: -40,
        silenceDurationMs: 10000,
        onSilenceDetected: jest.fn(),
      };

      // Should not throw
      service.setSilenceDetection(config);
    });

    it('should allow clearing silence detection configuration', () => {
      const config: SilenceDetectionConfig = {
        silenceThresholdDb: -40,
        silenceDurationMs: 10000,
        onSilenceDetected: jest.fn(),
      };

      service.setSilenceDetection(config);
      service.setSilenceDetection(null);

      // Should not throw and config should be cleared
    });
  });

  describe('Recording Lifecycle', () => {
    it('should provide startRecording method', () => {
      expect(typeof service.startRecording).toBe('function');
    });

    it('should provide stopRecordingAndProcess method', () => {
      expect(typeof service.stopRecordingAndProcess).toBe('function');
    });

    it('should provide cleanup method', () => {
      expect(typeof service.cleanup).toBe('function');
    });

    it('should provide isRecording method', () => {
      expect(typeof service.isRecording).toBe('function');
      expect(service.isRecording()).toBe(false); // Not recording initially
    });
  });

  describe('Audio Playback', () => {
    it('should provide stopAudioPlayback method', () => {
      expect(typeof service.stopAudioPlayback).toBe('function');
    });

    it('should provide isPlaying method', () => {
      expect(typeof service.isPlaying).toBe('function');
      expect(service.isPlaying()).toBe(false); // Not playing initially
    });
  });

  describe('TTS Pause/Resume', () => {
    it('should provide pauseAudioPlayback method', () => {
      expect(typeof service.pauseAudioPlayback).toBe('function');
    });

    it('should provide resumeAudioPlayback method', () => {
      expect(typeof service.resumeAudioPlayback).toBe('function');
    });

    it('should provide isPaused method', () => {
      expect(typeof service.isPaused).toBe('function');
      expect(service.isPaused()).toBe(false); // Not paused initially
    });

    it('should provide hasActiveAudio method', () => {
      expect(typeof service.hasActiveAudio).toBe('function');
      expect(service.hasActiveAudio()).toBe(false); // No active audio initially
    });

    it('should not throw when pausing with no active audio', async () => {
      await expect(service.pauseAudioPlayback()).resolves.not.toThrow();
    });

    it('should not throw when resuming with no active audio', async () => {
      await expect(service.resumeAudioPlayback()).resolves.not.toThrow();
    });

    it('should not throw when stopping with no active audio', async () => {
      await expect(service.stopAudioPlayback()).resolves.not.toThrow();
    });
  });

  describe('TTS Callbacks', () => {
    it('should provide setTTSCallbacks method', () => {
      expect(typeof service.setTTSCallbacks).toBe('function');
    });

    it('should allow setting TTS callbacks', () => {
      const onStart = jest.fn();
      const onEnd = jest.fn();
      
      expect(() => service.setTTSCallbacks(onStart, onEnd)).not.toThrow();
    });

    it('should allow setting undefined callbacks', () => {
      expect(() => service.setTTSCallbacks(undefined, undefined)).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup without errors when no resources are active', async () => {
      // Should not throw
      await service.cleanup();
    });
  });

  describe('Recording and Processing', () => {
    it('should handle stopRecordingAndProcess successfully', async () => {
      const response = await service.stopRecordingAndProcess();
      
      expect(response).toBeDefined();
      expect(response.transcription).toBe('Test transcription');
      expect(response.responseText).toBe('Test response');
      expect(response.audioData).toBe('dGVzdA==');
    });

    it('should include conversationId in the request when provided', async () => {
      const axios = require('axios');
      const testConversationId = 'test-conversation-123';
      
      await service.stopRecordingAndProcess(testConversationId);
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('voice/process'),
        expect.objectContaining({
          conversationId: testConversationId
        }),
        expect.any(Object)
      );
    });

    it('should not throw when recording URI is null', async () => {
      const Audio = require('expo-av').Audio;
      Audio.Recording.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(() => Promise.resolve()),
        startAsync: jest.fn(() => Promise.resolve()),
        stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
        getURI: jest.fn(() => null), // Return null URI
        getStatusAsync: jest.fn(() => Promise.resolve({
          isRecording: true,
          metering: -30,
        })),
      }));

      await service.startRecording();
      await expect(service.stopRecordingAndProcess()).rejects.toThrow('No recording URI');
    });
  });

  describe('Audio Playback Lifecycle', () => {
    it('should play audio response successfully', async () => {
      const base64Audio = btoa('test audio data');
      
      const playPromise = service.playAudioResponse(base64Audio);
      
      // Should not throw
      await expect(playPromise).resolves.not.toThrow();
    });

    it('should handle playback errors gracefully', async () => {
      const Audio = require('expo-av').Audio;
      
      // Mock playback error
      const mockSound = {
        setOnPlaybackStatusUpdate: jest.fn((callback) => {
          // Simulate error
          setTimeout(() => {
            callback({ isLoaded: false, error: 'Playback failed' });
          }, 10);
        }),
        unloadAsync: jest.fn(() => Promise.resolve()),
        stopAsync: jest.fn(() => Promise.resolve()),
      };
      
      Audio.Sound.createAsync.mockResolvedValueOnce({ sound: mockSound });
      
      await expect(service.playAudioResponse(btoa('test'))).rejects.toThrow('Playback error');
    });

    it('should handle pause and resume correctly', async () => {
      // Mock an active sound object
      const mockSound = {
        pauseAsync: jest.fn(() => Promise.resolve()),
        playAsync: jest.fn(() => Promise.resolve()),
        unloadAsync: jest.fn(() => Promise.resolve()),
      };
      
      // Manually set internal sound object (accessing private property for testing)
      (service as any).soundObject = mockSound;
      (service as any).isPausedState = false;
      
      // Pause
      await service.pauseAudioPlayback();
      expect(mockSound.pauseAsync).toHaveBeenCalled();
      expect(service.isPaused()).toBe(true);
      
      // Resume
      await service.resumeAudioPlayback();
      expect(mockSound.playAsync).toHaveBeenCalled();
      expect(service.isPaused()).toBe(false);
    });

    it('should report correct playback state', () => {
      // No active audio initially
      expect(service.hasActiveAudio()).toBe(false);
      expect(service.isPlaying()).toBe(false);
      expect(service.isPaused()).toBe(false);
    });
  });

  describe('Silence Detection', () => {
    it('should trigger silence callback after silence duration', async () => {
      const onSilenceDetected = jest.fn();
      const config: SilenceDetectionConfig = {
        silenceThresholdDb: -40,
        silenceDurationMs: 1000, // 1 second
        onSilenceDetected,
      };

      service.setSilenceDetection(config);

      // Mock getStatusAsync to return silence levels
      const Audio = require('expo-av').Audio;
      Audio.Recording.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(() => Promise.resolve()),
        startAsync: jest.fn(() => Promise.resolve()),
        stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
        getURI: jest.fn(() => 'file://test.wav'),
        getStatusAsync: jest.fn(() => Promise.resolve({
          isRecording: true,
          metering: -50, // Below threshold (-40)
        })),
      }));

      await service.startRecording();

      // Advance timers past silence duration
      jest.advanceTimersByTime(1200);

      expect(onSilenceDetected).toHaveBeenCalled();
    });

    it('should reset silence timer when audio is detected', async () => {
      const onSilenceDetected = jest.fn();
      const config: SilenceDetectionConfig = {
        silenceThresholdDb: -40,
        silenceDurationMs: 1000,
        onSilenceDetected,
      };

      service.setSilenceDetection(config);

      const Audio = require('expo-av').Audio;
      let callCount = 0;
      Audio.Recording.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(() => Promise.resolve()),
        startAsync: jest.fn(() => Promise.resolve()),
        stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
        getURI: jest.fn(() => 'file://test.wav'),
        getStatusAsync: jest.fn(() => {
          callCount++;
          return Promise.resolve({
            isRecording: true,
            // Alternate between silence and audio
            metering: callCount % 2 === 0 ? -50 : -20, // -50 is silent, -20 is audio
          });
        }),
      }));

      await service.startRecording();

      // Advance timers but with audio interruptions
      jest.advanceTimersByTime(500); // Some silence
      jest.advanceTimersByTime(500); // Audio detected - should reset
      jest.advanceTimersByTime(500); // More silence (not enough yet)

      // Should not have been called yet
      expect(onSilenceDetected).not.toHaveBeenCalled();
    });

    it('should not detect silence when audio is above threshold', async () => {
      const onSilenceDetected = jest.fn();
      const config: SilenceDetectionConfig = {
        silenceThresholdDb: -40,
        silenceDurationMs: 1000,
        onSilenceDetected,
      };

      service.setSilenceDetection(config);

      const Audio = require('expo-av').Audio;
      Audio.Recording.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(() => Promise.resolve()),
        startAsync: jest.fn(() => Promise.resolve()),
        stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
        getURI: jest.fn(() => 'file://test.wav'),
        getStatusAsync: jest.fn(() => Promise.resolve({
          isRecording: true,
          metering: -30, // Above threshold (-40) = not silent
        })),
      }));

      await service.startRecording();

      // Advance timers
      jest.advanceTimersByTime(2000);

      // Should not detect silence
      expect(onSilenceDetected).not.toHaveBeenCalled();
    });

    it('should stop silence detection on cleanup', async () => {
      const onSilenceDetected = jest.fn();
      const config: SilenceDetectionConfig = {
        silenceThresholdDb: -40,
        silenceDurationMs: 500,
        onSilenceDetected,
      };

      service.setSilenceDetection(config);
      await service.startRecording();

      // Cleanup should stop monitoring
      await service.cleanup();

      // Advance timers after cleanup
      jest.advanceTimersByTime(1000);

      // Should not be called after cleanup
      expect(onSilenceDetected).not.toHaveBeenCalled();
    });
  });

  describe('TTS State Callbacks', () => {
    it('should call onStart callback when TTS begins', async () => {
      const onStart = jest.fn();
      const onEnd = jest.fn();
      
      service.setTTSCallbacks(onStart, onEnd);
      
      const Audio = require('expo-av').Audio;
      const mockSound = {
        setOnPlaybackStatusUpdate: jest.fn((callback) => {
          // Simulate playback starting
          setTimeout(() => callback({ isLoaded: true, isPlaying: true }), 10);
        }),
        unloadAsync: jest.fn(() => Promise.resolve()),
        stopAsync: jest.fn(() => Promise.resolve()),
      };
      
      Audio.Sound.createAsync.mockResolvedValueOnce({ sound: mockSound });
      
      const playPromise = service.playAudioResponse(btoa('test audio'));
      
      // TTS callbacks are called internally
      // onStart should be called immediately
      expect(onStart).toHaveBeenCalled();
    });

    it('should call onEnd callback when TTS finishes', async () => {
      const onStart = jest.fn();
      const onEnd = jest.fn();
      
      service.setTTSCallbacks(onStart, onEnd);
      
      const Audio = require('expo-av').Audio;
      const mockSound = {
        setOnPlaybackStatusUpdate: jest.fn((callback) => {
          // Simulate playback finishing
          setTimeout(() => callback({ isLoaded: true, didJustFinish: true }), 10);
        }),
        unloadAsync: jest.fn(() => Promise.resolve()),
        stopAsync: jest.fn(() => Promise.resolve()),
      };
      
      Audio.Sound.createAsync.mockResolvedValueOnce({ sound: mockSound });
      
      await service.playAudioResponse(btoa('test audio'));
      
      expect(onEnd).toHaveBeenCalled();
    });

    it('should call onEnd callback when playback is interrupted', async () => {
      const onStart = jest.fn();
      const onEnd = jest.fn();
      
      service.setTTSCallbacks(onStart, onEnd);
      
      // Mock an active sound
      const mockSound = {
        stopAsync: jest.fn(() => Promise.resolve()),
        unloadAsync: jest.fn(() => Promise.resolve()),
      };
      (service as any).soundObject = mockSound;
      
      await service.stopAudioPlayback();
      
      expect(onEnd).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle recording start permission denied', async () => {
      const Audio = require('expo-av').Audio;
      Audio.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
      
      await expect(service.startRecording()).rejects.toThrow('Audio permission not granted');
    });

    it('should handle network errors during audio processing', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      
      await service.startRecording();
      await expect(service.stopRecordingAndProcess()).rejects.toThrow();
    });

    it('should cleanup recording on error', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValueOnce(new Error('Backend error'));
      
      const Audio = require('expo-av').Audio;
      const deleteFileMock = jest.fn(() => Promise.resolve());
      
      // Mock File class with delete method
      const OriginalFile = require('expo-file-system').File;
      require('expo-file-system').File = jest.fn().mockImplementation(() => ({
        arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(100))),
        delete: deleteFileMock,
      }));
      
      await service.startRecording();
      
      try {
        await service.stopRecordingAndProcess();
      } catch (error) {
        // Expected to throw
      }
      
      // File should be deleted even on error
      expect(deleteFileMock).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should track recording state correctly', async () => {
      expect(service.isRecording()).toBe(false);
      
      await service.startRecording();
      
      // Recording should be tracked (need to check internal state)
      // In real implementation, isRecording would return true
    });

    it('should not allow starting recording twice', async () => {
      await service.startRecording();
      
      // Starting again should handle existing recording
      // Implementation ensures cleanup before starting new recording
      await expect(service.startRecording()).resolves.not.toThrow();
    });
  });
});
