import { test, expect } from '@playwright/test';
import { ChatPage } from './chat-page';
import { TEST_SCENARIOS } from './test-data';

test.describe('Chat E2E Tests', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    
    // Navigate to the app
    await page.goto('/');
    
    // Navigate to chat screen
    await chatPage.navigateToChat();
  });

  test.describe('Chat Response Quality Tests', () => {
    for (const scenario of TEST_SCENARIOS) {
      test(`should provide meaningful response for: ${scenario.description}`, async () => {
        // Send the test message
        const response = await chatPage.sendMessageAndWaitForResponse(scenario.prompt);
        
        // Verify the response is meaningful and not a fallback
        await chatPage.verifyMeaningfulResponse(
          response, 
          scenario.expectedKeywords,
          scenario.requiredContent,
          scenario.avoidContent
        );
        
        // Log the response for debugging
        console.log(`Scenario: ${scenario.id}`);
        console.log(`Prompt: ${scenario.prompt}`);
        console.log(`Response: ${response}`);
        console.log(`Response length: ${response.length}`);
      });
    }
  });

  test.describe('Fallback Message Detection', () => {
    test('should not return fallback messages for the primary test scenarios', async () => {
      const primaryScenarios = [
        'Suggest games for 4 players.',
        'How to win at Ticket to Ride?',
        'Tell me the rules for Catan.'
      ];

      for (const query of primaryScenarios) {
        await chatPage.clearInput();
        const response = await chatPage.sendMessageAndWaitForResponse(query);
        
        // Log response for debugging
        console.log(`Query: "${query}"`);
        console.log(`Response: "${response}"`);
        console.log(`Is fallback: ${chatPage.isFallbackMessage(response)}`);
        
        expect(chatPage.isFallbackMessage(response), 
          `Query "${query}" should not return a fallback message. Got: "${response}"`
        ).toBe(false);

        // Response should be substantial
        expect(response.length, 
          `Query "${query}" should return a substantial response. Got: "${response}"`
        ).toBeGreaterThan(30);
      }
    });

    test('should not return fallback messages for valid game queries', async () => {
      const testQueries = [
        'What are the best board games?',
        'How do I play Monopoly?',
        'Recommend strategy games',
        'What games work for large groups?'
      ];

      for (const query of testQueries) {
        await chatPage.clearInput();
        const response = await chatPage.sendMessageAndWaitForResponse(query);
        
        expect(chatPage.isFallbackMessage(response), 
          `Query "${query}" should not return a fallback message. Got: "${response}"`
        ).toBe(false);
      }
    });
  });

  test.describe('Chat Functionality', () => {
    test('should successfully send and receive messages', async () => {
      const testMessage = 'Hello, can you help me?';
      
      // Send message
      await chatPage.sendMessage(testMessage);
      
      // Wait for response
      const response = await chatPage.waitForResponse();
      
      // Should get some response
      expect(response.length).toBeGreaterThan(0);
    });

    test('should handle multiple messages in sequence', async () => {
      const messages = [
        'Hi there!',
        'Can you recommend a game?',
        'Thank you!'
      ];

      for (const message of messages) {
        await chatPage.clearInput();
        const response = await chatPage.sendMessageAndWaitForResponse(message);
        expect(response.length).toBeGreaterThan(0);
      }
    });

    test('should maintain conversation context', async () => {
      // First message
      await chatPage.sendMessageAndWaitForResponse('I need a game for 4 players');
      
      // Follow-up question should work in context
      await chatPage.clearInput();
      const response = await chatPage.sendMessageAndWaitForResponse('What about something cooperative?');
      
      // Should get a meaningful response that's not a fallback
      expect(chatPage.isFallbackMessage(response)).toBe(false);
      expect(response.length).toBeGreaterThan(20);
    });
  });

  test.describe('Specific Game Queries', () => {
    test('should provide detailed response for Catan rules', async () => {
      const response = await chatPage.sendMessageAndWaitForResponse('Tell me the rules for Catan');
      
      // Should mention key Catan concepts
      const catanKeywords = ['settlement', 'resource', 'dice', 'trade', 'development', 'robber', 'catan'];
      expect(chatPage.containsExpectedKeywords(response, catanKeywords), 
        `Catan rules response should mention game concepts. Keywords: ${catanKeywords.join(', ')}. Got: "${response}"`
      ).toBe(true);
      
      // Must not be a fallback message
      expect(chatPage.isFallbackMessage(response), 
        `Catan rules response should not be a fallback message. Got: "${response}"`
      ).toBe(false);

      // Should be substantial
      expect(response.length, 
        `Catan rules response should be detailed. Got: "${response}"`
      ).toBeGreaterThan(50);
    });

    test('should provide strategy advice for Ticket to Ride', async () => {
      const response = await chatPage.sendMessageAndWaitForResponse('How to win at Ticket to Ride?');
      
      // Should mention strategy concepts
      const strategyKeywords = ['route', 'connect', 'block', 'strategy', 'points', 'cards', 'ticket', 'ride'];
      expect(chatPage.containsExpectedKeywords(response, strategyKeywords), 
        `Ticket to Ride strategy response should mention game strategy. Keywords: ${strategyKeywords.join(', ')}. Got: "${response}"`
      ).toBe(true);
      
      // Must not be a fallback message
      expect(chatPage.isFallbackMessage(response), 
        `Ticket to Ride strategy response should not be a fallback message. Got: "${response}"`
      ).toBe(false);

      // Should be substantial
      expect(response.length, 
        `Ticket to Ride strategy response should be detailed. Got: "${response}"`
      ).toBeGreaterThan(50);
    });

    test('should suggest appropriate games for player count', async () => {
      const response = await chatPage.sendMessageAndWaitForResponse('Suggest games for 4 players');
      
      // Should mention games or player count concepts
      const gameKeywords = ['game', 'play', 'recommend', 'four', '4', 'player'];
      expect(chatPage.containsExpectedKeywords(response, gameKeywords), 
        `Game suggestion response should mention games or players. Keywords: ${gameKeywords.join(', ')}. Got: "${response}"`
      ).toBe(true);
      
      // Must not be a fallback message
      expect(chatPage.isFallbackMessage(response), 
        `Game suggestion response should not be a fallback message. Got: "${response}"`
      ).toBe(false);

      // Should be substantial
      expect(response.length, 
        `Game suggestion response should be detailed. Got: "${response}"`
      ).toBeGreaterThan(50);
    });
  });
});
