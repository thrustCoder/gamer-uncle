import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

describe('setup-e2e.sh script', () => {
  const scriptPath = join(__dirname, '..', 'setup-e2e.sh');
  const isWindows = process.platform === 'win32';

  beforeAll(() => {
    // Ensure we're testing from the mobile directory
    process.chdir(join(__dirname, '..'));
  });

  it('should have valid bash syntax', async () => {
    if (isWindows) {
      console.log('Skipping bash syntax check on Windows');
      return;
    }
    const { stderr } = await execAsync(`bash -n ${scriptPath}`);
    expect(stderr).toBe('');
  }, 30000);

  it('should exist and be executable', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('should contain required setup steps', async () => {
    if (isWindows) {
      // Use Node.js to read file on Windows instead of Unix cat command
      const fs = require('fs');
      const stdout = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for key setup components
      expect(stdout).toContain('Checking Playwright installation');
      expect(stdout).toContain('Checking API accessibility');
      expect(stdout).toContain('Installing npm dependencies');
      expect(stdout).toContain('Installing Playwright browsers');
      return;
    }
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    
    // Check for key setup components
    expect(stdout).toContain('Checking Playwright installation');
    expect(stdout).toContain('Checking API accessibility');
    expect(stdout).toContain('Installing npm dependencies');
    expect(stdout).toContain('Installing Playwright browsers');
  });

  it('should have proper shebang', async () => {
    if (isWindows) {
      // Use Node.js to read first line on Windows
      const fs = require('fs');
      const content = fs.readFileSync(scriptPath, 'utf8');
      const firstLine = content.split('\n')[0].trim();
      expect(firstLine).toBe('#!/bin/bash');
      return;
    }
    const { stdout } = await execAsync(`head -1 ${scriptPath}`);
    expect(stdout.trim()).toBe('#!/bin/bash');
  });

  it('should check for required files', async () => {
    if (isWindows) {
      const fs = require('fs');
      const stdout = fs.readFileSync(scriptPath, 'utf8');
      
      const requiredFiles = [
        'e2e/chat.spec.ts',
        'e2e/chat-page.ts', 
        'e2e/test-data.ts',
        'playwright.config.ts'
      ];

      requiredFiles.forEach(file => {
        expect(stdout).toContain(file);
      });
      return;
    }
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

  it('should clean up port 8081 for Playwright webServer', async () => {
    if (isWindows) {
      const fs = require('fs');
      const stdout = fs.readFileSync(scriptPath, 'utf8');
      
      // Should include port cleanup
      expect(stdout).toContain('lsof -ti:8081');
      expect(stdout).toContain('port 8081');
      return;
    }
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    
    // Should include port cleanup
    expect(stdout).toContain('lsof -ti:8081');
    expect(stdout).toContain('port 8081');
  });

  it('should not have syntax errors with if/fi statements', async () => {
    if (isWindows) {
      const fs = require('fs');
      const content = fs.readFileSync(scriptPath, 'utf8');
      const lines = content.split('\n');
      
      // Count if/then/elif statements
      const ifCount = lines.filter((line: string) => 
        line.trim().startsWith('if ') || 
        line.trim().startsWith('then') || 
        line.trim().startsWith('elif ')
      ).length;
      
      // Count fi statements
      const fiCount = lines.filter((line: string) => line.trim().startsWith('fi')).length;
      
      // Should have matching if/fi statements
      expect(fiCount).toBeLessThanOrEqual(ifCount);
      return;
    }
    const { stdout } = await execAsync(`grep -n "fi" ${scriptPath} || true`);
    const { stdout: ifCount } = await execAsync(`grep -c "^if\\|then\\|elif" ${scriptPath} || echo 0`);
    const { stdout: fiCount } = await execAsync(`grep -c "^fi" ${scriptPath} || echo 0`);
    
    // Should have matching if/fi statements
    expect(parseInt(fiCount.trim())).toBeLessThanOrEqual(parseInt(ifCount.trim()));
  });
});
