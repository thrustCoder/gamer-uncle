/**
 * Fallback messages that should NOT appear in proper chat responses
 * These are copied from the backend AgentServiceClient.cs GetRandomFallbackMessage method
 */
export const FALLBACK_MESSAGES = [
  "Let me help you with that board game question! 🎯",
  "Looking into that for you! 🎲", 
  "Great board game question! Let me think... 🎮",
  "Checking my board game knowledge! 📚",
  "On it! Give me a moment to help! ⭐",
  "Let me find some great games for you! 🎲"
];

/**
 * Test scenarios for chat functionality
 */
export const TEST_SCENARIOS = [
  {
    id: 'game-suggestions-4-players',
    prompt: 'Suggest games for 4 players.',
    expectedKeywords: ['game', 'player', 'recommend', 'suggest', 'four', '4'],
    description: 'Should provide specific game recommendations for 4 players',
    requiredContent: ['game'], // Must mention games
    avoidContent: ['try again', 'error', 'went wrong']
  },
  {
    id: 'ticket-to-ride-strategy',
    prompt: 'How to win at Ticket to Ride?',
    expectedKeywords: ['ticket', 'ride', 'win', 'strategy', 'route', 'connect', 'cards', 'points'],
    description: 'Should provide specific strategy advice for Ticket to Ride',
    requiredContent: ['route', 'strategy'],
    avoidContent: ['try again', 'error', 'went wrong']
  },
  {
    id: 'catan-rules',
    prompt: 'Tell me the rules for Catan.',
    expectedKeywords: ['catan', 'rule', 'resource', 'settlement', 'dice', 'trade', 'development'],
    description: 'Should explain specific rules of Catan',
    requiredContent: ['catan', 'rule'],
    avoidContent: ['try again', 'error', 'went wrong']
  }
];

/**
 * Common selectors for the app
 */
export const SELECTORS = {
  // Navigation
  chatButton: '[data-testid="chat-button"]',
  backButton: '[data-testid="back-button"]',
  
  // Chat interface
  chatInput: '[data-testid="chat-input"]',
  sendButton: '[data-testid="send-button"]',
  messageContainer: '[data-testid="message-container"]',
  userMessage: '[data-testid="user-message"]',
  systemMessage: '[data-testid="system-message"]',
  typingIndicator: '[data-testid="typing-indicator"]',
  
  // Landing page
  uncleHeader: '[data-testid="uncle-header"]',
  
  // Fallbacks for when data-testid is not available
  fallback: {
    chatInput: 'input[placeholder*="Type"], textarea[placeholder*="Type"]',
    sendButton: 'button:has-text("Send"), touchableopacity:has-text("Send")',
    messageText: '.message-text, [class*="bubble"]'
  }
};

/**
 * Wait times for various operations
 * Increased timeouts for CI to handle slower loading and resource constraints
 */
export const TIMEOUTS = {
  API_RESPONSE: process.env.CI ? 30000 : 30000, // 30 second timeout for API responses
  TYPING_INDICATOR: process.env.CI ? 8000 : 5000, // Longer in CI for typing indicator to appear
  MESSAGE_APPEAR: process.env.CI ? 20000 : 15000, // Longer in CI for messages to appear
  PAGE_LOAD: process.env.CI ? 25000 : 15000, // Much longer in CI for page loads
  APP_INIT: process.env.CI ? 30000 : 20000, // App initialization timeout
  ELEMENT_VISIBLE: process.env.CI ? 15000 : 10000, // Element visibility timeout
  NAVIGATION: process.env.CI ? 10000 : 5000, // Navigation timeout
  RETRY_DELAY: 3000, // 3 seconds between retries (longer for CI)
  MAX_RETRIES: process.env.CI ? 5 : 3 // More retries in CI
};
