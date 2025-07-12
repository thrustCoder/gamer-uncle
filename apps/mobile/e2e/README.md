# E2E Testing with Playwright

This directory contains end-to-end tests for the Gamer Uncle mobile app using Playwright. The tests specifically focus on chat functionality to ensure the app provides meaningful responses rather than fallback messages.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npm run test:install
```

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Tests with UI (Headed Mode)
```bash
npm run test:e2e:headed
```

### Debug Tests
```bash
npm run test:e2e:debug
```

## Test Scenarios

The tests cover three main scenarios specified in the requirements:

### 1. Game Suggestions
- **Prompt**: "Suggest games for 4 players."
- **Expected**: Response should contain game recommendations and not be a fallback message
- **Keywords Checked**: game, player, recommend, suggest

### 2. Strategy Advice
- **Prompt**: "How to win at Ticket to Ride?"
- **Expected**: Response should provide strategy advice for Ticket to Ride
- **Keywords Checked**: ticket, ride, win, strategy, route

### 3. Game Rules
- **Prompt**: "Tell me the rules for Catan."
- **Expected**: Response should explain Catan rules
- **Keywords Checked**: catan, rule, resource, settlement, dice

## Fallback Message Detection

The tests specifically check that responses are NOT any of the following fallback messages from the backend:

- "Let me help you with that board game question! 🎯"
- "Looking into that for you! 🎲"
- "Great board game question! Let me think... 🎮"
- "Checking my board game knowledge! 📚"
- "On it! Give me a moment to help! ⭐"

## Test Structure

### Files

- `chat.spec.ts` - Main test file with all test scenarios
- `chat-page.ts` - Page Object Model for chat interactions
- `test-data.ts` - Test data and constants
- `playwright.config.ts` - Playwright configuration

### Test Organization

1. **Chat Response Quality Tests** - Verify meaningful responses for specific scenarios
2. **Fallback Message Detection** - Ensure no fallback messages for valid queries
3. **Chat Functionality** - Basic chat functionality tests
4. **Specific Game Queries** - Detailed tests for game-specific questions

## Configuration

The tests are configured to:

- Run against the web version of the React Native app
- Start the development server automatically
- Test across multiple browsers (Chrome, Firefox, Safari)
- Include mobile viewport testing
- Provide detailed reporting

## Debugging

If tests fail:

1. Check the HTML report generated after test runs
2. Use headed mode to see the browser interactions
3. Use debug mode to step through tests
4. Check console logs for API responses
5. Verify the app is running on the correct port (8081)

## Adding New Tests

To add new test scenarios:

1. Add the scenario to `TEST_SCENARIOS` in `test-data.ts`
2. The test will automatically be included in the main test loop
3. Or create specific tests in `chat.spec.ts` for custom scenarios

## Prerequisites

- The API backend must be running and accessible
- The app should be configured to use the correct API endpoint
- The web version of the app should build successfully

## Troubleshooting

### Common Issues

1. **Test timeouts**: Increase timeout values in `test-data.ts`
2. **Element not found**: Check if testID attributes are properly set
3. **API errors**: Verify backend is running and endpoints are correct
4. **Port conflicts**: Ensure port 8081 is available for the dev server
