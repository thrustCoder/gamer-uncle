import { test, expect } from '@playwright/test';
import { ChatPage } from './chat-page';

test.describe('Chat Core Functionality', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await page.goto('/');
    await chatPage.navigateToChat();
  });

  test('should handle game recommendation prompts', async () => {
    // Test the most common use case - game recommendations
    const response = await chatPage.sendMessageAndWaitForResponse('Suggest games for 4 players');
    
    expect(response.length).toBeGreaterThan(20);
    console.log(`Game recommendation: "${response}"`);
  });

  test('should respond to board game help requests', async () => {
    // Test another common prompt scenario
    const response = await chatPage.sendMessageAndWaitForResponse('Help me pick a strategy game');
    
    expect(response.length).toBeGreaterThan(10);
    expect(chatPage.isFallbackMessage(response)).toBe(false);
    console.log(`Strategy game help: "${response}"`);
  });
});
