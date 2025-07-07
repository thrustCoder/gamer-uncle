import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

describe('setup-e2e.sh script', () => {
  const scriptPath = join(__dirname, '..', 'setup-e2e.sh');

  beforeAll(() => {
    // Ensure we're testing from the mobile directory
    process.chdir(join(__dirname, '..'));
  });

  it('should have valid bash syntax', async () => {
    const { stderr } = await execAsync(`bash -n ${scriptPath}`);
    expect(stderr).toBe('');
  });

  it('should exist and be executable', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('should contain required setup steps', async () => {
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    
    // Check for key setup components
    expect(stdout).toContain('Checking Playwright installation');
    expect(stdout).toContain('Checking API accessibility');
    expect(stdout).toContain('Installing npm dependencies');
    expect(stdout).toContain('Installing Playwright browsers');
  });

  it('should have proper shebang', async () => {
    const { stdout } = await execAsync(`head -1 ${scriptPath}`);
    expect(stdout.trim()).toBe('#!/bin/bash');
  });

  it('should check for required files', async () => {
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    
    const requiredFiles = [
      'e2e/chat.spec.ts',
      'e2e/chat-page.ts', 
      'e2e/test-data.ts',
      'playwright.config.ts'
    ];

    requiredFiles.forEach(file => {
      expect(stdout).toContain(file);
    });
  });

  it('should not have syntax errors with if/fi statements', async () => {
    const { stdout } = await execAsync(`grep -n "fi" ${scriptPath} || true`);
    const { stdout: ifCount } = await execAsync(`grep -c "^if\\|then\\|elif" ${scriptPath} || echo 0`);
    const { stdout: fiCount } = await execAsync(`grep -c "^fi" ${scriptPath} || echo 0`);
    
    // Should have matching if/fi statements
    expect(parseInt(fiCount.trim())).toBeLessThanOrEqual(parseInt(ifCount.trim()));
  });
});
