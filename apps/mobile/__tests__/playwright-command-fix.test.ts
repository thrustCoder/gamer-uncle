import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';

const execAsync = promisify(exec);

describe('Playwright command fix', () => {
  it('should not use invalid --output-dir option in package.json scripts', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    // Check that no script uses the invalid --output-dir option
    Object.values(packageJson.scripts).forEach((script: unknown) => {
      expect(typeof script === 'string' ? script : '').not.toContain('--output-dir');
    });
  });

  it('should have valid playwright command syntax', async () => {
    // Test that playwright command with reporter option works
    try {
      const { stderr } = await execAsync('npx playwright test --reporter=junit --list');
      // Should not contain "unknown option" error
      expect(stderr).not.toContain('unknown option');
    } catch (error) {
      // The command might fail due to no tests found, but it shouldn't have syntax errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toContain('unknown option');
    }
  });

  it('should have correct CI scripts without invalid options', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    // Check specific CI script
    // CI should use the wrapper script that configures environment and reporters
    expect(packageJson.scripts['test:e2e:ci']).toBe('./run-e2e-ci.sh');
    expect(packageJson.scripts['test:e2e:ci']).not.toContain('--output-dir');
  });

  it('should configure output in playwright config file instead of CLI', () => {
    const configContent = readFileSync('playwright.config.ts', 'utf8');
    
    // Verify that output configuration is in the config file
    expect(configContent).toContain('outputFile: \'test-results/junit-results.xml\'');
    expect(configContent).toContain('\'html\', { outputFolder: \'playwright-report\', open: \'never\' }');
  });
});
