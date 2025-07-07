import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('E2E Setup Validation', () => {
  test('setup script should execute without syntax errors', async () => {
    // Test that the setup script has valid syntax
    try {
      const { stderr } = await execAsync('bash -n setup-e2e.sh', { 
        cwd: process.cwd() 
      });
      expect(stderr).toBe('');
    } catch (error) {
      throw new Error(`Setup script has syntax errors: ${error}`);
    }
  });

  test('required e2e files should exist', async () => {
    const requiredFiles = [
      'e2e/chat.spec.ts',
      'e2e/chat-page.ts',
      'e2e/test-data.ts',
      'playwright.config.ts',
      'setup-e2e.sh'
    ];

    for (const file of requiredFiles) {
      try {
        await execAsync(`test -f ${file}`);
      } catch (error) {
        throw new Error(`Required file ${file} does not exist`);
      }
    }
  });

  test('setup script should have executable permissions', async () => {
    try {
      await execAsync('test -x setup-e2e.sh');
    } catch (error) {
      throw new Error('setup-e2e.sh is not executable');
    }
  });

  test('package.json should have required e2e scripts', async ({ page }) => {
    // Read package.json and verify e2e scripts exist
    try {
      const { stdout } = await execAsync('cat package.json');
      const packageJson = JSON.parse(stdout);
      
      expect(packageJson.scripts).toHaveProperty('test:e2e');
      expect(packageJson.scripts).toHaveProperty('test:e2e:headed');
      expect(packageJson.scripts).toHaveProperty('test:e2e:debug');
      expect(packageJson.scripts).toHaveProperty('test:install');
    } catch (error) {
      throw new Error(`Failed to verify package.json scripts: ${error}`);
    }
  });
});
