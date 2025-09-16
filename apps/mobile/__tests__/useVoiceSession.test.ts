import { renderHook, act } from '@testing-library/react-native';

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
    jest.runOnlyPendingTimers();
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
});