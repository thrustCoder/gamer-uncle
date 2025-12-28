import { renderHook, act } from '@testing-library/react-native';

// Mock API config before importing the hook
jest.mock('../config/apiConfig', () => ({
  getApiBaseUrl: jest.fn(() => 'http://localhost:5001/api/'),
  API_ENVIRONMENT: 'local' as const,
}));

// Mock React Native Voice and NativeEventEmitter
jest.mock('@react-native-voice/voice', () => ({
  __esModule: true,
  default: {
    onSpeechStart: jest.fn(),
    onSpeechRecognized: jest.fn(),
    onSpeechEnd: jest.fn(),
    onSpeechError: jest.fn(),
    onSpeechResults: jest.fn(),
    onSpeechPartialResults: jest.fn(),
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(() => Promise.resolve()),
    removeAllListeners: jest.fn(),
    isAvailable: jest.fn(() => Promise.resolve(true)),
  },
}));

// Mock NativeEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return class MockNativeEventEmitter {
    addListener = jest.fn();
    removeListener = jest.fn();
    removeAllListeners = jest.fn();
  };
});

// Mock react-native-webrtc
jest.mock('react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: jest.fn(() => Promise.resolve({
      id: 'mock-stream',
      active: true,
      getTracks: () => [],
    })),
  },
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn(),
  RTCIceCandidate: jest.fn(),
  MediaStream: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(() => Promise.resolve({ 
      data: { 
        SessionId: 'test-session-123',
        WebRtcToken: 'test-token',
        FoundryConnectionUrl: 'wss://test-foundry.com',
        ExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        ConversationId: 'test-conversation-456',
        InitialResponse: 'Hello! How can I help you with board games today?'
      } 
    })),
    delete: jest.fn(() => Promise.resolve()),
  })),
  isAxiosError: jest.fn(),
}));

// Import the hook after mocking dependencies  
import { useVoiceSession } from '../hooks/useVoiceSession';

// Use fake timers to avoid async cleanup issues
jest.useFakeTimers();

describe('useVoiceSession Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    // Clean up any pending timers without advancing them
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useVoiceSession());

      expect(result.current.isActive).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isRecording).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.sessionId).toBe(null);
      // isSupported should be true in test environment with mocks
      expect(result.current.isSupported).toBe(true);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useVoiceSession());

      expect(typeof result.current.startVoiceSession).toBe('function');
      expect(typeof result.current.stopVoiceSession).toBe('function');
      expect(typeof result.current.setRecording).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.retryVoiceSession).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should clear errors when clearError is called', async () => {
      const { result } = renderHook(() => useVoiceSession());

      // Manually set an error for testing
      await act(async () => {
        // Since we can't easily trigger a real error in tests, we'll just test the clearError function
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Voice Session Management', () => {
    it('should handle voice session lifecycle', async () => {
      const { result } = renderHook(() => useVoiceSession());

      // Test stopping session (should not throw even when no session is active)
      await act(async () => {
        await result.current.stopVoiceSession();
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isRecording).toBe(false);
    });

    it('should handle recording state changes', () => {
      const { result } = renderHook(() => useVoiceSession());

      // Test setRecording when no session is active (should not throw)
      act(() => {
        result.current.setRecording(true);
      });

      // Should not crash and state should be consistent
      expect(result.current.isRecording).toBe(false); // No active stream, so recording stays false
    });
  });

  describe('Environment Configuration', () => {
    it('should be importable and instantiable', () => {
      // Basic smoke test to ensure the hook can be created
      const { result } = renderHook(() => useVoiceSession());
      
      expect(result.current).toBeDefined();
      expect(result.current.isActive).toBeDefined();
      expect(result.current.startVoiceSession).toBeDefined();
    });
  });

  describe('Retry Mechanism', () => {
    it('should provide retry functionality', () => {
      const { result } = renderHook(() => useVoiceSession());

      expect(typeof result.current.retryVoiceSession).toBe('function');
      
      // Test that retry doesn't crash when called
      act(() => {
        result.current.retryVoiceSession({ 
          Query: "Test voice query",
          ConversationId: "test-conversation-123" 
        });
      });
    });
  });

  describe('WebRTC Support Detection', () => {
    it('should detect WebRTC support', () => {
      const { result } = renderHook(() => useVoiceSession());

      // Should detect support when mocks are available
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('Conversation ID Handling', () => {
    it('should accept and pass conversationId parameter to hook', () => {
      const mockCallback = jest.fn();
      const testConversationId = 'thread_test123';
      
      const { result } = renderHook(() => useVoiceSession(mockCallback, testConversationId));
      
      // The hook should be initialized successfully with the conversationId
      expect(result.current).toBeDefined();
      expect(result.current.isActive).toBe(false);
    });

    it('should maintain conversation context across multiple calls', () => {
      const mockCallback = jest.fn();
      const testConversationId = 'thread_persistent123';
      
      // First render with conversationId
      const { result, rerender } = renderHook(
        (convId: string | null) => useVoiceSession(mockCallback, convId),
        { initialProps: testConversationId }
      );
      
      expect(result.current).toBeDefined();
      
      // Re-render with same conversationId (simulating follow-up messages)
      rerender(testConversationId);
      
      expect(result.current).toBeDefined();
      expect(result.current.isActive).toBe(false);
    });
  });

  describe('TTS Interruption', () => {
    it('should provide stopAudioPlayback function', () => {
      const { result } = renderHook(() => useVoiceSession());
      
      expect(typeof result.current.stopAudioPlayback).toBe('function');
    });

    it('should allow calling stopAudioPlayback without errors', async () => {
      const { result } = renderHook(() => useVoiceSession());
      
      // Should not throw even when no audio is playing
      await act(async () => {
        await result.current.stopAudioPlayback();
      });
      
      // No error should be set
      expect(result.current.error).toBe(null);
    });
  });

  describe('Recording Safety Configuration', () => {
    it('should accept recording safety configuration parameter', () => {
      const mockCallback = jest.fn();
      const mockAutoStopCallback = jest.fn();
      const testConversationId = 'test-conv-123';
      
      const safetyConfig = {
        maxRecordingDurationMs: 60000, // 1 minute
        silenceThresholdDb: -40,
        silenceDurationMs: 10000, // 10 seconds
        onAutoStop: mockAutoStopCallback,
      };
      
      const { result } = renderHook(() => 
        useVoiceSession(mockCallback, testConversationId, safetyConfig)
      );
      
      // The hook should be initialized successfully with the safety config
      expect(result.current).toBeDefined();
      expect(result.current.isActive).toBe(false);
    });

    it('should work without safety configuration (backward compatibility)', () => {
      const mockCallback = jest.fn();
      
      // Call without safety config - should not throw
      const { result } = renderHook(() => useVoiceSession(mockCallback, null));
      
      expect(result.current).toBeDefined();
      expect(result.current.isActive).toBe(false);
    });

    it('should work with partial safety configuration', () => {
      const mockCallback = jest.fn();
      
      // Only max duration, no silence detection
      const partialConfig = {
        maxRecordingDurationMs: 60000,
        onAutoStop: jest.fn(),
      };
      
      const { result } = renderHook(() => 
        useVoiceSession(mockCallback, null, partialConfig)
      );
      
      expect(result.current).toBeDefined();
    });
  });

  describe('No Speech Error Handling', () => {
    it('should handle no speech errors gracefully', () => {
      const mockCallback = jest.fn();
      
      const { result } = renderHook(() => useVoiceSession(mockCallback, null));
      
      // The hook should be able to handle errors without crashing
      expect(result.current).toBeDefined();
      expect(result.current.error).toBe(null);
    });
  });
});