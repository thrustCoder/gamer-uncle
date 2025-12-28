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

  describe('Cleanup', () => {
    it('should cleanup without errors when no resources are active', async () => {
      // Should not throw
      await service.cleanup();
    });
  });
});
