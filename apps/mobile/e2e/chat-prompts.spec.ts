import { test, expect } from '@playwright/test';
import { ChatPage } from './chat-page';

test.describe('Chat Prompt Scenarios', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await page.goto('/');
    await chatPage.navigateToChat();
  });

  test('should handle game recommendation for specific player count', async () => {
    const response = await chatPage.sendMessageAndWaitForResponse('What are good games for 6 players?');
    
    expect(response.length).toBeGreaterThan(20);
    expect(response.toLowerCase()).toMatch(/game|player|recommend/);
    console.log(`6-player games: "${response}"`);
  });

  test('should respond to theme-based game requests', async () => {
    const response = await chatPage.sendMessageAndWaitForResponse('I want a pirate-themed board game');
    
    expect(response.length).toBeGreaterThan(15);
    expect(chatPage.isFallbackMessage(response)).toBe(false);
    console.log(`Pirate game response: "${response}"`);
  });

  test('should handle difficulty level questions', async () => {
    const response = await chatPage.sendMessageAndWaitForResponse('Suggest an easy game for beginners');
    
    expect(response.length).toBeGreaterThan(15);
    expect(response.toLowerCase()).toMatch(/beginner|easy|simple|start/);
    console.log(`Beginner game: "${response}"`);
  });

  test('should respond to game duration queries', async () => {
    const response = await chatPage.sendMessageAndWaitForResponse('I need a quick 30-minute game');
    
    expect(response.length).toBeGreaterThan(10);
    expect(response.toLowerCase()).toMatch(/quick|short|30|minute|time/);
    console.log(`Quick game response: "${response}"`);
  });
});
