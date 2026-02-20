import { test, expect } from '@playwright/test';

/**
 * Voice Chat E2E Tests
 * Focused on core voice functionality with resilient patterns
 * Minimal test suite to avoid intermittent failures
 */
test.describe('Voice Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Set timeout for all tests - voice can be slow
    test.setTimeout(30000);
    
    await page.goto('/');
    
    // Wait for app to be ready before testing voice features
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 });
  });

  test('should display microphone button in chat interface', async ({ page }) => {
    // Basic UI presence test - most reliable
    const micButton = page.getByTestId('mic-button');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
  });

  test('should show recording state when microphone is pressed', async ({ page }) => {
    // Test core interaction without relying on API calls
    const micButton = page.getByTestId('mic-button');
    
    // Press and hold microphone button using mouse events
    await micButton.hover();
    await page.mouse.down();
    
    // Should show some indication of recording (be flexible about exact text)
    await expect(page.locator('[data-testid*="recording"], [data-testid*="voice"]')).toBeVisible({
      timeout: 5000
    });
    
    // Release button
    await page.mouse.up();
  });

  test('should handle voice session initialization gracefully', async ({ page }) => {
    // Mock API response to ensure predictable behavior
    await page.route('**/api/voice/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          SessionId: 'test-session-123',
          WebRtcToken: 'test-token',
          FoundryConnectionUrl: 'wss://test.foundry.com',
          ExpiresAt: new Date(Date.now() + 1800000).toISOString(),
          ConversationId: 'test-conv-456',
          InitialResponse: 'Hello! I can help with board game questions.'
        })
      });
    });

    const micButton = page.getByTestId('mic-button');
    await micButton.click();
    
    // Should not show error state
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test('should show error when voice service is unavailable', async ({ page }) => {
    // Mock API error to test error handling
    await page.route('**/api/voice/session', route => 
      route.fulfill({ 
        status: 500, 
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' })
      })
    );

    const micButton = page.getByTestId('mic-button');
    await micButton.click();

    // Should show some error indication (be flexible about exact text)
    await expect(page.locator('text=/error|failed|unavailable/i')).toBeVisible({
      timeout: 10000
    });
  });

  // Only test simulator banner in development environments
  test('should show simulator banner when in simulator mode', async ({ page }) => {
    // Skip this test in production
    test.skip(process.env.NODE_ENV === 'production', 'Simulator test not relevant in production');
    
    // Check for simulator indicator (flexible selector)
    const simulatorIndicator = page.locator('text=/simulator/i');
    
    if (await simulatorIndicator.isVisible()) {
      await expect(simulatorIndicator).toContainText(/mode|testing|mock/i);
    } else {
      // Skip if not in simulator mode - this is expected on real devices
      test.skip(true, 'Not running in simulator mode');
    }
  });
});

/**
 * Voice Chat Integration Tests
 * More comprehensive tests for when backend is available
 */
test.describe('Voice Chat Integration @integration', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(30000); // 30 second timeout for voice integration tests
    await page.goto('/');
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 });
  });

  test('should complete full voice session lifecycle', async ({ page }) => {
    // Only run this test if backend is reachable
    const response = await page.request.get('/api/health').catch(() => null);
    test.skip(!response || response.status() !== 200, 'Backend not available');

    const micButton = page.getByTestId('mic-button');
    
    // Start voice session
    await micButton.click();
    
    // Wait for connection (be patient with real API)
    await expect(page.locator('[data-testid*="voice-active"], text=/connected|ready/i')).toBeVisible({
      timeout: 15000
    });
    
    // Simulate recording with press and hold
    await micButton.hover();
    await page.mouse.down();
    await expect(page.locator('[data-testid*="recording"]')).toBeVisible();
    await page.mouse.up();
    
    // Should return to ready state
    await expect(page.locator('[data-testid*="recording"]')).not.toBeVisible({
      timeout: 5000
    });
  });
});