import { VoiceSessionRequest, VoiceSessionResponse } from '../hooks/useVoiceSession';

/**
 * SIMULATOR ONLY - Mock service for iOS simulator development
 * This service is only active during iOS simulator development sessions
 * and provides realistic voice interaction simulation for UI testing
 * 
 * ⚠️ This code is dead-code eliminated in production builds
 */
export class SimulatorMockService {
  private static readonly MOCK_RESPONSES = [
    "Great question! For 4 players, I'd recommend Ticket to Ride - it's strategic but accessible.",
    "Wingspan is perfect for that player count! It combines engine-building with beautiful bird themes.",
    "Have you considered Azul? It's a tile-laying game that works brilliantly with 3-4 players.",
    "Splendor is excellent for quick strategic games. Each round takes about 30 minutes.",
    "For cooperative games, try Pandemic or Forbidden Island - they're great for working together!",
    "If you like deck-building, Dominion is the classic choice that started the genre.",
  ];

  private static readonly MOCK_QUERIES = [
    "What's a good strategy game for 4 players?",
    "How do you win at Settlers of Catan?", 
    "Can you recommend a cooperative game?",
    "What are some quick games under 30 minutes?",
    "Best games for beginners to board gaming?",
    "What's the difference between engine-building and deck-building games?",
  ];

  /**
   * Creates a mock voice session response for simulator testing
   * Simulates realistic API timing and response structure
   */
  static async createMockSession(request: VoiceSessionRequest): Promise<VoiceSessionResponse> {
    console.log('🔧 [SIMULATOR ONLY] Creating mock voice session:', request);
    
    // Simulate realistic API delay (800ms - 1.2s)
    const delay = 800 + Math.random() * 400;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const mockResponse = this.MOCK_RESPONSES[
      Math.floor(Math.random() * this.MOCK_RESPONSES.length)
    ];
    
    const sessionId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const conversationId = request.ConversationId || `sim-conv-${Date.now()}`;
    
    return {
      SessionId: sessionId,
      WebRtcToken: 'simulator-mock-token-' + sessionId,
      FoundryConnectionUrl: 'wss://simulator-mock.local',
      ExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      ConversationId: conversationId,
      InitialResponse: mockResponse,
    };
  }

  /**
   * Simulates voice input processing
   * Returns a realistic mock query after processing delay
   */
  static async simulateVoiceInput(): Promise<string> {
    const mockQuery = this.MOCK_QUERIES[
      Math.floor(Math.random() * this.MOCK_QUERIES.length)
    ];
    
    console.log('🎤 [SIMULATOR] Simulating voice input processing...');
    
    // Simulate voice processing time (1.5s - 2.5s)
    const processingTime = 1500 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return mockQuery;
  }

  /**
   * Simulates session cleanup for testing
   */
  static async simulateSessionCleanup(sessionId: string): Promise<void> {
    console.log(`🧹 [SIMULATOR] Cleaning up mock session: ${sessionId}`);
    
    // Simulate cleanup delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Gets a random mock response for testing
   */
  static getRandomMockResponse(): string {
    return this.MOCK_RESPONSES[
      Math.floor(Math.random() * this.MOCK_RESPONSES.length)
    ];
  }
}