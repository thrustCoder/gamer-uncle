/**
 * Unit tests for E2E test helper functions
 * These tests verify that our fallback message detection works correctly
 */

import { FALLBACK_MESSAGES, TEST_SCENARIOS } from './test-data';

describe('E2E Test Helpers', () => {
  // Helper function to mimic the ChatPage.isFallbackMessage method
  const isFallbackMessage = (response: string): boolean => {
    const normalizedResponse = response.toLowerCase().trim();
    return FALLBACK_MESSAGES.some(fallback => {
      const normalizedFallback = fallback.toLowerCase().trim();
      return normalizedResponse === normalizedFallback || 
             normalizedResponse.includes(normalizedFallback) ||
             normalizedFallback.includes(normalizedResponse);
    });
  };

  // Helper function to check if response contains expected keywords
  const containsExpectedKeywords = (response: string, keywords: string[]): boolean => {
    const lowerResponse = response.toLowerCase();
    return keywords.some(keyword => lowerResponse.includes(keyword.toLowerCase()));
  };

  describe('Fallback Message Detection', () => {
    test('should correctly identify exact fallback messages', () => {
      const fallbackResponses = [
        "Let me help you with that board game question! 🎯",
        "Looking into that for you! 🎲",
        "Great board game question! Let me think... 🎮",
        "Checking my board game knowledge! 📚",
        "On it! Give me a moment to help! ⭐",
        "Let me find some great games for you! 🎲"
      ];

      fallbackResponses.forEach(response => {
        expect(isFallbackMessage(response)).toBe(true);
      });
    });

    test('should correctly identify fallback messages with minor variations', () => {
      const variationResponses = [
        "  Let me help you with that board game question! 🎯  ",  // extra whitespace
        "let me help you with that board game question! 🎯",      // different case
        "Looking into that for you! 🎲 ",                        // trailing space
      ];

      variationResponses.forEach(response => {
        expect(isFallbackMessage(response)).toBe(true);
      });
    });

    test('should NOT identify meaningful responses as fallback messages', () => {
      const meaningfulResponses = [
        "For 4 players, I recommend Ticket to Ride! It's a great strategy game where you collect train cards and claim railway routes across a map. The game supports 2-5 players and typically takes 30-60 minutes to play.",
        "To win at Ticket to Ride, focus on these key strategies: 1) Complete your destination tickets for bonus points, 2) Claim longer routes for more points, 3) Try to block opponents' routes when possible, 4) Collect train cards efficiently before claiming routes.",
        "Catan is a resource management and trading game. Players collect resources (wood, brick, ore, grain, sheep) by rolling dice, then use these to build settlements, cities, and roads. The first player to reach 10 victory points wins!"
      ];

      meaningfulResponses.forEach(response => {
        expect(isFallbackMessage(response)).toBe(false);
      });
    });

    test('should NOT identify short responses with keywords as fallback messages', () => {
      const shortResponses = [
        "Great game choice!",
        "Perfect for 4 players!",
        "Good strategy!"
      ];

      shortResponses.forEach(response => {
        expect(isFallbackMessage(response)).toBe(false);
      });
    });
  });

  describe('Keyword Detection', () => {
    test('should correctly identify responses with expected keywords', () => {
      const testCases = [
        {
          response: "For 4 players, I recommend Azul, Splendor, or Ticket to Ride!",
          keywords: ['player', 'recommend', 'game'],
          shouldMatch: true
        },
        {
          response: "To win at Ticket to Ride, focus on connecting routes and blocking opponents.",
          keywords: ['route', 'strategy', 'win'],
          shouldMatch: true
        },
        {
          response: "Catan rules: Roll dice, collect resources, build settlements and cities.",
          keywords: ['catan', 'rule', 'resource'],
          shouldMatch: true
        },
        {
          response: "This is completely unrelated content about cooking recipes.",
          keywords: ['game', 'player', 'strategy'],
          shouldMatch: false
        }
      ];

      testCases.forEach(({ response, keywords, shouldMatch }) => {
        expect(containsExpectedKeywords(response, keywords)).toBe(shouldMatch);
      });
    });
  });

  describe('Test Scenarios Validation', () => {
    test('should have all required test scenario fields', () => {
      TEST_SCENARIOS.forEach(scenario => {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('prompt');
        expect(scenario).toHaveProperty('expectedKeywords');
        expect(scenario).toHaveProperty('description');
        expect(scenario).toHaveProperty('requiredContent');
        expect(scenario).toHaveProperty('avoidContent');
        
        expect(typeof scenario.id).toBe('string');
        expect(typeof scenario.prompt).toBe('string');
        expect(Array.isArray(scenario.expectedKeywords)).toBe(true);
        expect(typeof scenario.description).toBe('string');
        expect(Array.isArray(scenario.requiredContent)).toBe(true);
        expect(Array.isArray(scenario.avoidContent)).toBe(true);
      });
    });

    test('should have the three primary test scenarios', () => {
      const expectedScenarios = [
        'game-suggestions-4-players',
        'ticket-to-ride-strategy', 
        'catan-rules'
      ];

      const actualScenarioIds = TEST_SCENARIOS.map(s => s.id);
      
      expectedScenarios.forEach(expectedId => {
        expect(actualScenarioIds).toContain(expectedId);
      });
    });

    test('should have meaningful prompts for all scenarios', () => {
      const expectedPrompts = [
        'Suggest games for 4 players.',
        'How to win at Ticket to Ride?',
        'Tell me the rules for Catan.'
      ];

      const actualPrompts = TEST_SCENARIOS.map(s => s.prompt);
      
      expectedPrompts.forEach(expectedPrompt => {
        expect(actualPrompts).toContain(expectedPrompt);
      });
    });
  });
});
