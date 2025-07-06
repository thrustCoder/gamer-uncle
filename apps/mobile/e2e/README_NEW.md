# E2E Testing for Gamer Uncle App

This directory contains end-to-end tests for the Gamer Uncle mobile application using Playwright. The tests specifically validate that the chat functionality provides meaningful responses rather than fallback messages for key scenarios.

## Test Scenarios

The e2e tests focus on three primary scenarios that should never return fallback messages:

1. **Game Suggestions**: "Suggest games for 4 players."
2. **Strategy Advice**: "How to win at Ticket to Ride?"
3. **Game Rules**: "Tell me the rules for Catan."

## Key Features

### Fallback Message Detection
The tests include sophisticated fallback message detection that identifies when the API returns generic responses instead of meaningful content. The fallback messages are automatically extracted from the backend `AgentServiceClient.cs` file.

### Robust Page Object Model
- `chat-page.ts`: Contains reusable methods for interacting with the chat interface
- `test-data.ts`: Centralized test data and configuration
- `chat.spec.ts`: Main test specifications

### Comprehensive Validation
Tests verify that responses:
- Are not fallback messages
- Contain relevant keywords
- Include required content
- Avoid problematic content (errors, etc.)
- Are substantial in length (not just short phrases)

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run test:install
```

### Setup and Run
```bash
# Run setup script and tests
npm run test:setup

# Or run tests directly
npm run test:e2e           # Headless mode
npm run test:e2e:headed    # With browser UI
npm run test:e2e:debug     # Debug mode
```

### Unit Tests
```bash
# Run unit tests for test helpers
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

## Test Architecture

### Test Data Structure
```typescript
interface TestScenario {
  id: string;
  prompt: string;
  expectedKeywords: string[];
  description: string;
  requiredContent: string[];
  avoidContent: string[];
}
```

### Fallback Messages
The tests automatically detect these fallback messages from the backend:
- "Let me help you with that board game question! 🎯"
- "Looking into that for you! 🎲"
- "Great board game question! Let me think... 🎮"
- "Checking my board game knowledge! 📚"
- "On it! Give me a moment to help! ⭐"
- "Let me find some great games for you! 🎲"

## Configuration

### Playwright Config
- **Base URL**: `http://localhost:8081`
- **Timeout**: 45 seconds for API responses
- **Retry**: 2 retries on CI
- **Browsers**: Chrome, Firefox, Safari (desktop and mobile)

### Environment Variables
The tests use the production API endpoint by default:
- **API URL**: `https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net/api`

## Troubleshooting

### Common Issues

1. **API Not Accessible**
   - Ensure the backend API is running and accessible
   - Check network connectivity
   - Verify API endpoint in `services/ApiClient.ts`

2. **Tests Failing Due to Slow Responses**
   - AI responses can be slow; timeouts are set to 45 seconds
   - Check if API is under heavy load

3. **Fallback Messages Detected**
   - This indicates the AI agent is not providing meaningful responses
   - Check backend logs for errors
   - Verify the AI agent configuration

### Debugging Tips

1. **Use Debug Mode**
   ```bash
   npm run test:e2e:debug
   ```

2. **Check Console Output**
   Tests log all prompts and responses for debugging

3. **Review Screenshots**
   Playwright automatically captures screenshots on failures

4. **Inspect Network Traffic**
   Use browser dev tools to inspect API calls

## File Structure

```
e2e/
├── chat.spec.ts           # Main test specifications
├── chat-page.ts           # Page object for chat interface
├── test-data.ts           # Test scenarios and configuration
├── test-helpers.test.ts   # Unit tests for helper functions
└── README.md              # This file

playwright.config.ts       # Playwright configuration
setup-e2e.sh              # Test setup script
jest.config.js            # Jest configuration for unit tests
```

## Contributing

When adding new test scenarios:

1. Add the scenario to `TEST_SCENARIOS` in `test-data.ts`
2. Include appropriate `expectedKeywords`, `requiredContent`, and `avoidContent`
3. Update fallback messages if the backend changes
4. Run both unit tests and e2e tests to ensure everything works

## Monitoring

The tests serve as continuous monitoring of the chat quality. Regular execution helps ensure:
- The AI agent is functioning properly
- Responses remain meaningful and helpful
- No regressions in chat functionality
- Fallback messages are only used when appropriate
