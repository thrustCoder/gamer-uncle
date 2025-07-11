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
    
    // Should not have tool-specific tests
    const toolSpecs = [
      'dice-roller.spec.ts',
      'timer.spec.ts', 
      'team-randomizer.spec.ts',
      'turn-selector.spec.ts'
    ];
    
    toolSpecs.forEach(spec => {
      expect(specFiles).not.toContain(spec);
    });
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
    expect(landingContent).toContain('should display all navigation elements');
    expect(landingContent).toContain('should navigate to Chat screen');
    expect(landingContent).toContain('should navigate to at least one tool screen and back');
    
    // Should not have detailed tool tests
    expect(landingContent).not.toContain('Turn Selector screen');
    expect(landingContent).not.toContain('Team Randomizer screen');
    expect(landingContent).not.toContain('Dice Roller screen');
  });

  it('should have essential chat tests only', () => {
    const chatSpecPath = path.join(e2eDir, 'chat.spec.ts');
    const chatContent = fs.readFileSync(chatSpecPath, 'utf8');
    
    // Should have basic chat functionality
    expect(chatContent).toContain('should successfully send and receive messages');
    expect(chatContent).toContain('should provide meaningful game recommendations');
    expect(chatContent).toContain('should handle multiple messages in sequence');
    
    // Should not have extensive test scenarios
    expect(chatContent).not.toContain('TEST_SCENARIOS');
    expect(chatContent).not.toContain('Specific Game Queries');
    expect(chatContent).not.toContain('Fallback Message Detection');
  });
});
