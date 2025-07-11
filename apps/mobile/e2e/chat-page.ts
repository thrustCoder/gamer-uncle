import { Page, expect } from '@playwright/test';

export class ChatPage {
  constructor(private page: Page) {}

  async navigateToChat() {
    // Click on the uncle header to navigate to chat
    await this.page.click('[data-testid="uncle-header"]');
    
    // Wait for chat input to be visible
    await expect(this.page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 });
  }

  async sendMessage(message: string) {
    // Clear input and type message
    await this.page.fill('[data-testid="chat-input"]', message);
    
    // Click send button
    await this.page.click('[data-testid="send-button"]');
  }

  async waitForResponse(timeout: number = 15000): Promise<string> {
    // Wait for a response message to appear
    await this.page.waitForSelector('[data-testid="system-message"]', { timeout });
    
    // Get the last system message
    const responseElement = this.page.locator('[data-testid="system-message"]').last();
    const response = await responseElement.textContent();
    
    return response || '';
  }

  async sendMessageAndWaitForResponse(message: string, timeout: number = 15000): Promise<string> {
    await this.sendMessage(message);
    return await this.waitForResponse(timeout);
  }

  async clearInput() {
    await this.page.fill('[data-testid="chat-input"]', '');
  }

  isFallbackMessage(message: string): boolean {
    const fallbackPhrases = [
      'I\'m not sure',
      'Could you clarify',
      'I don\'t understand',
      'Please try again',
      'Sorry, I couldn\'t'
    ];
    
    const lowerMessage = message.toLowerCase();
    return fallbackPhrases.some(phrase => lowerMessage.includes(phrase.toLowerCase()));
  }

  async getChatHistory(): Promise<string[]> {
    const messages = await this.page.locator('[data-testid="system-message"]').allTextContents();
    return messages;
  }

  async isResponseLoading(): Promise<boolean> {
    return await this.page.locator('[data-testid="loading-indicator"]').isVisible();
  }
}
