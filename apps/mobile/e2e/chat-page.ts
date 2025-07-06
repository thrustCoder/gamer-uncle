import { Page, expect } from '@playwright/test';
import { SELECTORS, TIMEOUTS, FALLBACK_MESSAGES } from './test-data';

export class ChatPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the chat screen from the landing page
   */
  async navigateToChat() {
    // Click on the Uncle header image to navigate to chat
    try {
      await this.page.click(SELECTORS.uncleHeader, { timeout: TIMEOUTS.PAGE_LOAD });
    } catch {
      // Fallback: look for any clickable image or element that navigates to chat
      await this.page.click('img[src*="uncle_header"], [data-testid*="uncle"], [onclick*="Chat"]', 
        { timeout: TIMEOUTS.PAGE_LOAD });
    }
    
    // Wait for chat page to load
    await this.waitForChatPageLoaded();
  }

  /**
   * Wait for the chat page to be fully loaded
   */
  async waitForChatPageLoaded() {
    // Wait for either chat input or send button to be visible
    try {
      await this.page.waitForSelector(SELECTORS.chatInput, { timeout: TIMEOUTS.PAGE_LOAD });
    } catch {
      await this.page.waitForSelector(SELECTORS.fallback.chatInput, { timeout: TIMEOUTS.PAGE_LOAD });
    }
  }

  /**
   * Send a message in the chat
   */
  async sendMessage(message: string) {
    // Find and fill the input field
    let inputSelector = SELECTORS.chatInput;
    try {
      await this.page.waitForSelector(inputSelector, { timeout: 5000 });
    } catch {
      inputSelector = SELECTORS.fallback.chatInput;
      await this.page.waitForSelector(inputSelector, { timeout: 5000 });
    }

    await this.page.fill(inputSelector, message);
    
    // Find and click the send button
    let sendSelector = SELECTORS.sendButton;
    try {
      await this.page.click(sendSelector);
    } catch {
      await this.page.click(SELECTORS.fallback.sendButton);
    }
  }

  /**
   * Wait for a response message to appear
   */
  async waitForResponse(): Promise<string> {
    // Wait for typing indicator to disappear (if it appears)
    try {
      await this.page.waitForSelector(SELECTORS.typingIndicator, { timeout: TIMEOUTS.TYPING_INDICATOR });
      await this.page.waitForSelector(SELECTORS.typingIndicator, { state: 'detached', timeout: TIMEOUTS.API_RESPONSE });
    } catch {
      // Typing indicator might not appear, continue
    }

    // Wait for system message to appear
    let messageSelector = SELECTORS.systemMessage;
    try {
      await this.page.waitForSelector(messageSelector, { timeout: TIMEOUTS.MESSAGE_APPEAR });
    } catch {
      messageSelector = SELECTORS.fallback.messageText;
      await this.page.waitForSelector(messageSelector, { timeout: TIMEOUTS.MESSAGE_APPEAR });
    }

    // Get the last message text
    const messages = await this.page.locator(messageSelector).all();
    const lastMessage = messages[messages.length - 1];
    return await lastMessage.textContent() || '';
  }

  /**
   * Send a message and wait for response
   */
  async sendMessageAndWaitForResponse(message: string): Promise<string> {
    await this.sendMessage(message);
    return await this.waitForResponse();
  }

  /**
   * Check if a response is a fallback message
   */
  isFallbackMessage(response: string): boolean {
    const normalizedResponse = response.toLowerCase().trim();
    return FALLBACK_MESSAGES.some(fallback => {
      const normalizedFallback = fallback.toLowerCase().trim();
      // Check for exact match or if response contains the fallback
      return normalizedResponse === normalizedFallback || 
             normalizedResponse.includes(normalizedFallback) ||
             normalizedFallback.includes(normalizedResponse);
    });
  }

  /**
   * Check if response contains expected keywords
   */
  containsExpectedKeywords(response: string, keywords: string[]): boolean {
    const lowerResponse = response.toLowerCase();
    return keywords.some(keyword => lowerResponse.includes(keyword.toLowerCase()));
  }

  /**
   * Check if response contains required content
   */
  containsRequiredContent(response: string, requiredContent: string[]): boolean {
    const lowerResponse = response.toLowerCase();
    return requiredContent.every(content => lowerResponse.includes(content.toLowerCase()));
  }

  /**
   * Check if response avoids problematic content
   */
  avoidsProblematicContent(response: string, avoidContent: string[]): boolean {
    const lowerResponse = response.toLowerCase();
    return !avoidContent.some(content => lowerResponse.includes(content.toLowerCase()));
  }

  /**
   * Verify that a response is meaningful (not a fallback and contains relevant content)
   */
  async verifyMeaningfulResponse(response: string, expectedKeywords: string[], requiredContent?: string[], avoidContent?: string[]) {
    // Should not be a fallback message
    expect(this.isFallbackMessage(response), 
      `Response should not be a fallback message. Got: "${response}"`
    ).toBe(false);

    // Should contain at least one expected keyword
    expect(this.containsExpectedKeywords(response, expectedKeywords),
      `Response should contain at least one of: ${expectedKeywords.join(', ')}. Got: "${response}"`
    ).toBe(true);

    // Should contain all required content if specified
    if (requiredContent && requiredContent.length > 0) {
      expect(this.containsRequiredContent(response, requiredContent),
        `Response should contain all of: ${requiredContent.join(', ')}. Got: "${response}"`
      ).toBe(true);
    }

    // Should avoid problematic content if specified
    if (avoidContent && avoidContent.length > 0) {
      expect(this.avoidsProblematicContent(response, avoidContent),
        `Response should not contain any of: ${avoidContent.join(', ')}. Got: "${response}"`
      ).toBe(true);
    }

    // Should be reasonably long (more than just a short phrase)
    expect(response.length, 
      `Response should be substantial. Got: "${response}"`
    ).toBeGreaterThan(20);
  }

  /**
   * Clear the chat input
   */
  async clearInput() {
    try {
      await this.page.fill(SELECTORS.chatInput, '');
    } catch {
      await this.page.fill(SELECTORS.fallback.chatInput, '');
    }
  }

  /**
   * Get all messages in the chat
   */
  async getAllMessages(): Promise<string[]> {
    try {
      const messages = await this.page.locator(SELECTORS.messageContainer).all();
      return Promise.all(messages.map((msg: any) => msg.textContent() || ''));
    } catch {
      const messages = await this.page.locator(SELECTORS.fallback.messageText).all();
      return Promise.all(messages.map((msg: any) => msg.textContent() || ''));
    }
  }
}
