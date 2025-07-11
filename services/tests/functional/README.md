# GamerUncle API Functional Tests

This project contains end-to-end functional tests for the GamerUncle API. These tests validate the API endpoints by making HTTP requests and verifying responses.

## Test Scenarios

The functional tests cover the following scenarios for the `RecommendationsController`:

### **Infrastructure & Connectivity Tests**
1. **Health Check** - Tests API availability and response
2. **Smoke Test** - Tests endpoint existence and basic functionality

### **Core Functionality Tests**
3. **Valid Game Recommendation Request** - Tests successful recommendation with proper query
4. **Minimal Query** - Tests handling of minimal/simple queries
5. **Conversation ID** - Tests conversation tracking functionality

### **Validation & Error Handling Tests**
6. **Empty Query** - Tests error handling for empty queries
7. **Invalid JSON** - Tests error handling for malformed requests
8. **Missing Required Fields** - Tests validation of required fields
9. **Long Query** - Tests handling of very long queries

### **Response Structure Validation Tests**
10. **Valid JSON Structure** - Ensures API returns properly formatted JSON
11. **Correct Content Type** - Validates response headers and content type

### **Security & Special Characters Tests**
12. **Special Characters** - Tests handling of symbols and punctuation
13. **Unicode Characters** - Tests international characters and emojis
14. **SQL Injection Prevention** - Tests security against SQL injection attempts
15. **XSS Prevention** - Tests protection against cross-site scripting

### **Happy Path Realistic Scenarios**
16. **Detailed Requirements** - "Suggest me a game for 4 players that involves bluffing..." *(with retry logic)*
17. **Simple Inquiry** - "I am looking for a new board game." *(with retry logic)*
18. **Specific Game Info** - "Tell me about Catan" *(with retry logic)*
19. **Category Questions** - "What are worker placement games?" *(with retry logic)*
20. **Strategy Questions** - "How to win at Ticket to Ride?" *(with retry logic)*
21. **Conceptual Questions** - "What makes a game family friendly?" *(with retry logic)*

**Note**: Realistic scenario tests now include retry logic (max 1 retry) to prevent fallback responses and ensure meaningful AI-generated answers.

## Anti-Fallback Response Logic

The functional tests include sophisticated logic to prevent fallback responses in realistic scenario tests:

### **Fallback Response Detection**
- Detects known fallback patterns from the API (e.g., "Let me help you with that board game question! 🎯")
- Identifies suspiciously short responses (< 20 characters)
- Ensures tests validate meaningful AI-generated content

### **Retry Logic**
- Realistic scenario tests automatically retry once if a fallback response is detected
- Maximum of 2 attempts per test (initial + 1 retry)
- 2-second delay between attempts to allow for API recovery
- Tests fail with descriptive messages if all attempts return fallback responses

### **Enhanced Validation**
- Tests verify response quality, not just HTTP status codes
- Ensures substantial responses for complex queries
- Validates that AI provides educational content rather than generic responses

## Configuration

The tests can run against different environments using configuration files:

- `appsettings.local.json` - For local development (localhost:5000)
- `appsettings.dev.json` - For Dev environment (Azure App Service)

### Environment Variables

- `TEST_ENVIRONMENT` - Specifies which environment to test (Local, Dev)
- `API_BASE_URL` - Override the base URL for the API

## Running Tests

### Local Development

```bash
# Set environment variables
export TEST_ENVIRONMENT=Local
export API_BASE_URL=http://localhost:5000

# Run tests
dotnet test
```

### Against Dev Environment

```bash
# Set environment variables
export TEST_ENVIRONMENT=Dev
export API_BASE_URL=https://gamer-uncle-dev-app-svc.azurewebsites.net

# Run tests
dotnet test
```

## Pipeline Integration

### Pull Request Pipeline
- Starts local API instance
- Runs functional tests against local API
- Validates changes don't break API functionality

### Main Branch Pipeline
- Runs after deployment to Dev environment
- Validates deployed API functionality
- Ensures deployment was successful

## Test Categories

The functional tests are designed to:
- Validate API contracts and response formats
- Test error handling and edge cases
- Ensure proper HTTP status codes
- Verify response structure and content
- Test authentication and authorization (if applicable)

## Adding New Tests

When adding new tests:
1. Follow the existing naming convention
2. Use proper HTTP status code assertions
3. Validate response structure
4. Include both positive and negative test cases
5. Add appropriate test documentation
