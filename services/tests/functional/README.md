# GamerUncle API Functional Tests

This project contains end-to-end functional tests for the GamerUncle API. These tests validate the API endpoints by making HTTP requests and verifying responses.

## Test Scenarios

The functional tests cover the following scenarios for the `RecommendationsController`:

1. **Valid Game Recommendation Request** - Tests successful recommendation with proper query
2. **Minimal Query** - Tests handling of minimal/simple queries
3. **Empty Query** - Tests error handling for empty queries
4. **Invalid JSON** - Tests error handling for malformed requests
5. **Missing Required Fields** - Tests validation of required fields
6. **Long Query** - Tests handling of very long queries
7. **Conversation ID** - Tests conversation tracking functionality
8. **Health Check** - Tests API availability

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
