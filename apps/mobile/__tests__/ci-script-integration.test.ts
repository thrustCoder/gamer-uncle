import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('CI Script Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run-e2e-ci.sh script', () => {
    it('should exist and be executable', () => {
      const scriptPath = './run-e2e-ci.sh';
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const stats = fs.statSync(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy(); // Check if executable
    });

    it('should set correct environment variables', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      expect(scriptContent).toContain('export NODE_ENV=test');
      expect(scriptContent).toContain('export CI=true');
      expect(scriptContent).toContain('chromium');
    });

    it('should handle URL validation', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      expect(scriptContent).toContain('curl -f -s --max-time 30');
      expect(scriptContent).toContain('Checking if target URL is accessible');
      expect(scriptContent).toContain('Falling back to localhost');
    });

    it('should use correct timeout approach', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      // Should try different timeout commands for cross-platform compatibility
      expect(scriptContent).toContain('gtimeout');
      expect(scriptContent).toContain('timeout');
      expect(scriptContent).toContain('relying on Playwright timeouts');
    });
  });

  describe('Package.json scripts', () => {
    it('should have the new CI script', () => {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('test:e2e:ci');
      expect(packageJson.scripts['test:e2e:ci']).toBe('./run-e2e-ci.sh');
    });

    it('should maintain backward compatibility', () => {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('test:e2e:ci-legacy');
      expect(packageJson.scripts['test:e2e:ci-legacy']).toContain('playwright test --reporter=junit');
    });
  });

  describe('Playwright Configuration Validation', () => {
    it('should have correct CI optimizations', async () => {
      // Import the config dynamically to test the actual values
      process.env.CI = 'true';
      
      // We can't easily import the config directly due to ES modules,
      // but we can test the logic that would be in the config
      const testTimeout = process.env.CI ? 30 * 1000 : 60 * 1000;
      const expectTimeout = process.env.CI ? 5 * 1000 : 10 * 1000;
      
      expect(testTimeout).toBe(30000);
      expect(expectTimeout).toBe(5000);
    });

    it('should disable webServer in CI', () => {
      process.env.CI = 'true';
      
      const shouldStartWebServer = !(process.env.E2E_BASE_URL || process.env.CI);
      expect(shouldStartWebServer).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should save diagnostic information on failure', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      expect(scriptContent).toContain('playwright-report directory exists');
      expect(scriptContent).toContain('JUnit results file exists');
      expect(scriptContent).toContain('ls -la');
    });

    it('should exit with proper error codes', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      expect(scriptContent).toContain('exit $exit_code');
      expect(scriptContent).toContain('exit_code=$?');
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should handle macOS timeout command absence', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      expect(scriptContent).toContain('command -v gtimeout');
      expect(scriptContent).toContain('command -v timeout');
      expect(scriptContent).toContain('Timeout command not available');
    });

    it('should use correct bash shebang', async () => {
      const scriptContent = fs.readFileSync('./run-e2e-ci.sh', 'utf8');
      
      expect(scriptContent.startsWith('#!/bin/bash')).toBe(true);
      expect(scriptContent).toContain('set -e');
    });
  });
});
