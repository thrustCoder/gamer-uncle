import { describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Playwright Configuration Tests', () => {
  let playwrightConfigContent: string;
  
  beforeEach(() => {
    const configPath = path.join(__dirname, '..', 'playwright.config.ts');
    playwrightConfigContent = fs.readFileSync(configPath, 'utf-8');
  });

  test('should have optimized timeouts for CI environment', () => {
    // Assert
    expect(playwrightConfigContent).toContain('actionTimeout: process.env.CI ? 10000 : 30000');
    expect(playwrightConfigContent).toContain('navigationTimeout: process.env.CI ? 20000 : 60000');
    expect(playwrightConfigContent).toContain('timeout: process.env.CI ? 20 * 1000 : 60 * 1000');
  });

  test('should have reduced retries for CI to prevent hanging', () => {
    // Assert
    expect(playwrightConfigContent).toContain('retries: process.env.CI ? 1 : 0');
  });

  test('should have correct expect timeout for CI', () => {
    // Assert
    expect(playwrightConfigContent).toContain('timeout: process.env.CI ? 3 * 1000 : 10 * 1000');
  });

  test('should use single worker in CI for stability', () => {
    // Assert
    expect(playwrightConfigContent).toContain('workers: process.env.CI ? 1 : undefined');
  });

  test('should have correct base URL configuration', () => {
    // Assert
    expect(playwrightConfigContent).toContain('baseURL: process.env.E2E_BASE_URL');
    expect(playwrightConfigContent).toContain('gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net');
    expect(playwrightConfigContent).toContain('http://localhost:8081');
  });

  test('should have appropriate reporters for CI', () => {
    // Assert
    expect(playwrightConfigContent).toContain("['junit', { outputFile: 'test-results/junit-results.xml' }]");
    expect(playwrightConfigContent).toContain("['html', { outputFolder: 'playwright-report', open: 'never' }]");
    expect(playwrightConfigContent).toContain("['line']");
    expect(playwrightConfigContent).toContain("['github']");
  });

  test('should enable headless mode in CI', () => {
    // Assert
    expect(playwrightConfigContent).toContain('...(process.env.CI && { headless: true })');
  });

  test('should limit browsers in CI for performance', () => {
    // Assert
    expect(playwrightConfigContent).toContain('...(process.env.CI ? [] : [');
    expect(playwrightConfigContent).toContain('Desktop Firefox');
    expect(playwrightConfigContent).toContain('Desktop Safari');
  });

  test('should have web server configuration for local development', () => {
    // Assert
    expect(playwrightConfigContent).toContain('webServer: (process.env.E2E_BASE_URL || process.env.CI) ? undefined');
    expect(playwrightConfigContent).toContain("command: 'npm run web'");
    expect(playwrightConfigContent).toContain("url: 'http://localhost:8081'");
  });

  test('should have proper screenshot and video configuration', () => {
    // Assert
    expect(playwrightConfigContent).toContain("screenshot: 'only-on-failure'");
    expect(playwrightConfigContent).toContain("video: 'retain-on-failure'");
    expect(playwrightConfigContent).toContain("trace: 'on-first-retry'");
  });
});

describe('E2E CI Script Tests', () => {
  let ciScriptContent: string;
  
  beforeEach(() => {
    const scriptPath = path.join(__dirname, '..', 'run-e2e-ci.sh');
    ciScriptContent = fs.readFileSync(scriptPath, 'utf-8');
  });

  test('should set required environment variables', () => {
    // Assert
    expect(ciScriptContent).toContain('export NODE_ENV=test');
    expect(ciScriptContent).toContain('export CI=true');
  });

  test('should have timeout protection', () => {
    // Assert
    expect(ciScriptContent).toContain('timeout_duration="30m"');
    expect(ciScriptContent).toContain('gtimeout $timeout_duration');
    expect(ciScriptContent).toContain('timeout $timeout_duration');
  });

  test('should validate Playwright installation', () => {
    // Assert
    expect(ciScriptContent).toContain('if npx playwright install --with-deps chromium');
    expect(ciScriptContent).toContain('echo "✅ Playwright browsers installed successfully"');
  });

  test('should have URL accessibility check', () => {
    // Assert
    expect(ciScriptContent).toContain('if curl -f -s --max-time 15 --retry 2');
    expect(ciScriptContent).toContain('echo "✅ Target URL is accessible: $E2E_BASE_URL"');
  });

  test('should have comprehensive error reporting', () => {
    // Assert
    expect(ciScriptContent).toContain('echo "📋 Gathering diagnostic information..."');
    expect(ciScriptContent).toContain('ls -la playwright-report/');
    expect(ciScriptContent).toContain('ls -la test-results/');
  });

  test('should have proper exit code handling', () => {
    // Assert
    expect(ciScriptContent).toContain('exit_code=0');
    expect(ciScriptContent).toContain('|| exit_code=$?');
    expect(ciScriptContent).toContain('exit $exit_code');
  });
});
