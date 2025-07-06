# Gamer Uncle E2E Tests - New Features Documentation

## Overview
This document outlines the new e2e tests added for the Turn Selector and Team Randomizer screens in the Gamer Uncle mobile app.

## New Test Files Added

### Turn Selector Tests
- **File**: `e2e/turn-selector.spec.ts`
- **Page Object**: `e2e/turn-selector-page.ts`
- **Coverage**: 
  - Screen display and element visibility
  - Adding single and multiple players
  - Random turn selection functionality
  - Clearing players list
  - Navigation back to landing screen
  - Edge cases and error handling
  - State management during interactions

### Team Randomizer Tests  
- **File**: `e2e/team-randomizer.spec.ts`
- **Page Object**: `e2e/team-randomizer-page.ts`
- **Coverage**:
  - Screen display and element visibility
  - Adding players to teams
  - Setting team count
  - Generating random teams
  - Handling different team configurations
  - Clearing players list
  - Navigation back to landing screen
  - Edge cases and validation
  - Multiple team generation runs

## Test Structure

Both test suites follow the same pattern:
1. **Setup**: Navigate to app and specific screen
2. **Element Verification**: Check all UI elements are visible
3. **Functionality Tests**: Test core features
4. **Edge Cases**: Handle invalid inputs and boundary conditions
5. **Navigation**: Verify back navigation works
6. **State Management**: Ensure proper state handling

## Key Test Scenarios

### Turn Selector
- Add/remove players from turn selection
- Select random turns from player list
- Handle empty player lists
- Maintain selection state across interactions
- Clear all players functionality

### Team Randomizer
- Add players and set team count
- Generate balanced random teams
- Handle edge cases (more teams than players)
- Regenerate teams with same players
- Different team size configurations

## TestID Requirements

The tests rely on the following testIDs being present in the React Native components:

### Turn Selector Screen
- `turn-selector-title`
- `turn-selector-player-input`
- `turn-selector-add-player-button`
- `turn-selector-clear-players-button`
- `turn-selector-select-turn-button`
- `turn-selector-selected-player`
- `turn-selector-players-list`

### Team Randomizer Screen
- `team-randomizer-title`
- `team-randomizer-player-input`
- `team-randomizer-add-player-button`
- `team-randomizer-clear-players-button`
- `team-randomizer-teams-count-input`
- `team-randomizer-generate-teams-button`
- `team-randomizer-teams-display`
- `team-randomizer-players-list`

### Navigation
- `landing-turn-selector-button`
- `landing-team-randomizer-button`
- `back-button`

## Integration with CI/CD

These tests are included in:
- `complete-suite.spec.ts` for comprehensive testing
- Azure DevOps pipeline for PR and CD environments
- Local development via `npm run e2e:dev`

## Running the Tests

```bash
# Run all e2e tests
npm run e2e

# Run specific test files
npx playwright test e2e/turn-selector.spec.ts
npx playwright test e2e/team-randomizer.spec.ts

# Run in development mode
npm run e2e:dev
```

## Maintenance Notes

1. **TestID Updates**: If component testIDs change, update both page objects and tests
2. **Screen Layout Changes**: Update selectors in page objects if UI layout changes
3. **Feature Updates**: Add new test cases when functionality is added/modified
4. **Error Handling**: Monitor test results for new edge cases to cover

## Next Steps

1. Verify all testIDs are implemented in React Native components
2. Run tests locally and in CI to ensure they pass
3. Add additional edge case scenarios as needed
4. Consider adding accessibility and performance checks
