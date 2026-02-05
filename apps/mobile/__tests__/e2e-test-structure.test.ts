import * as fs from 'fs';
import * as path from 'path';

describe('E2E Test Structure', () => {
  const e2eDir = path.join(process.cwd(), 'e2e');

  it('should have essential E2E test files only', () => {
    const files = fs.readdirSync(e2eDir);
    const specFiles = files.filter((file: string) => file.endsWith('.spec.ts'));
    
    // Should have only essential test files
    const expectedSpecs = [
      'smoke.spec.ts',
      'landing.spec.ts', 
      'chat.spec.ts',
      'complete-suite.spec.ts'
    ];
    
    expectedSpecs.forEach(spec => {
      expect(specFiles).toContain(spec);
    });
    
    // Should not have timer specific tests (removed)
    const removedToolSpecs = [
      'timer.spec.ts'
    ];
    
    removedToolSpecs.forEach(spec => {
      expect(specFiles).not.toContain(spec);
    });
    
    // Dice roller test should exist
    expect(specFiles).toContain('dice-roller.spec.ts');
    
    // Should have team-randomizer and turn-selector tests
    expect(specFiles).toContain('team-randomizer.spec.ts');
    expect(specFiles).toContain('turn-selector.spec.ts');
  });

  it('should have playwright/test dependency properly configured', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    expect(packageJson.devDependencies).toHaveProperty('@playwright/test');
    expect(packageJson.scripts).toHaveProperty('test:e2e:ci');
  });

  it('should have simplified test structures', () => {
    const landingSpecPath = path.join(e2eDir, 'landing.spec.ts');
    const landingContent = fs.readFileSync(landingSpecPath, 'utf8');
    
    // Should have simplified test structure
    expect(landingContent).toContain('should load landing page and navigate to chat');
    expect(landingContent).toContain('Navigate to chat');
    expect(landingContent).toContain('Verify landing page loads');
    
    // Should not have detailed tool tests
    expect(landingContent).not.toContain('Turn Selector screen');
    expect(landingContent).not.toContain('Team Randomizer screen');
    expect(landingContent).not.toContain('Dice Roller screen');
  });

  it('should have essential chat tests only', () => {
    const chatSpecPath = path.join(e2eDir, 'chat.spec.ts');
    const chatContent = fs.readFileSync(chatSpecPath, 'utf8');
    
    // Should have basic chat functionality
    expect(chatContent).toContain('should handle game recommendation prompts');
    expect(chatContent).toContain('should respond to board game help requests');
    expect(chatContent).toContain('sendMessageAndWaitForResponse');
    
    // Should not have extensive test scenarios
    expect(chatContent).not.toContain('TEST_SCENARIOS');
    expect(chatContent).not.toContain('Specific Game Queries');
    expect(chatContent).not.toContain('Fallback Message Detection');
  });
});
