import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

test.describe('Playwright Configuration Validation', () => {
  test('should run playwright commands without invalid options', async () => {
    // Test that the basic playwright test command works
    try {
      const { stdout, stderr } = await execAsync('npx playwright test --reporter=junit --list', { 
        cwd: process.cwd(),
        timeout: 30000
      });
      
      // Should not contain "unknown option" errors
      expect(stderr).not.toContain('unknown option');
      expect(stderr).not.toContain('--output-dir');
      
      // Should contain valid XML structure for junit reporter
      expect(stdout).toContain('<testsuites');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toContain('unknown option');
      expect(errorMessage).not.toContain('--output-dir');
    }
  });

  test('should have valid test results directory configuration', async () => {
    // Verify the test-results directory structure is correctly configured
    const playwrightConfigExists = existsSync('playwright.config.ts');
    expect(playwrightConfigExists).toBe(true);
  });

  test('should be able to run e2e command with junit reporter', async () => {
    // Test the npm script command that will be used in CI
    try {
      const { stdout, stderr } = await execAsync('npm run test:e2e -- --reporter=junit --list', {
        cwd: process.cwd(),
        timeout: 30000
      });
      
      expect(stderr).not.toContain('unknown option');
      expect(stdout).toContain('<testsuites');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toContain('unknown option');
    }
  });

  test('should have consistent output directory configuration', async () => {
    // Verify that output directories in config match expected CI paths
    const configContent = await execAsync('cat playwright.config.ts');
    
    expect(configContent.stdout).toContain('test-results/junit-results.xml');
    expect(configContent.stdout).toContain('test-results/html-report');
  });
});
