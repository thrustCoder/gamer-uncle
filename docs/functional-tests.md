# End-to-End Functional Tests Implementation

## Overview

This document describes the implementation of end-to-end functional tests for the GamerUncle API. The tests validate the API endpoints by making HTTP requests and verifying responses in different environments.

## Architecture

### Project Structure
```
services/tests/functional/
├── GamerUncle.Api.FunctionalTests.csproj    # Test project file
├── README.md                                # Test documentation
├── appsettings.json                         # Base configuration
├── appsettings.local.json                   # Local environment config
├── appsettings.dev.json                     # Dev environment config
├── run-local-tests.ps1                      # PowerShell test runner
├── run-local-tests.sh                       # Bash test runner
├── Configuration/
│   └── TestConfiguration.cs                # Configuration model
├── Infrastructure/
│   └── TestFixture.cs                       # Test setup and HTTP client
└── Controllers/
    └── RecommendationsControllerTests.cs    # Functional tests
```

### Test Configuration

The tests use a configuration-based approach to support multiple environments:

- **Local Environment**: Tests run against `http://localhost:5000`
- **Dev Environment**: Tests run against `https://gamer-uncle-dev-app-svc.azurewebsites.net`

Configuration is loaded from:
1. Base `appsettings.json`
2. Environment-specific file (e.g., `appsettings.dev.json`)
3. Environment variables (override configuration)

### Test Scenarios

#### RecommendationsController Tests

1. **Valid Game Recommendation Request**
   - Tests successful recommendation with proper query
   - Validates response structure and content

2. **Minimal Query**
   - Tests handling of simple queries
   - Ensures basic functionality works

3. **Empty Query**
   - Tests error handling for empty queries
   - Validates appropriate HTTP status codes

4. **Invalid JSON**
   - Tests error handling for malformed requests
   - Ensures proper validation

5. **Missing Required Fields**
   - Tests validation of required fields
   - Verifies model binding

6. **Long Query**
   - Tests handling of very long queries
   - Validates system limits

7. **Conversation ID**
   - Tests conversation tracking functionality
   - Validates thread management

8. **Health Check**
   - Tests API availability
   - Ensures service is running

#### VoiceController Tests

> **Note**: Voice tests are automatically skipped in CI/CD environments where Azure Speech Service credentials are not configured. This is controlled by the `TEST_ENVIRONMENT` or `SKIP_VOICE_TESTS` environment variables.

1. **WAV Audio Processing**
   - Tests complete voice pipeline (STT → AI → TTS)
   - Validates audio format handling

2. **PCM16 Audio Processing**
   - Tests raw PCM16 audio processing
   - Validates format conversion

3. **Invalid Audio Data**
   - Tests error handling for malformed audio
   - Validates input validation

4. **Empty Audio Data**
   - Tests handling of empty requests
   - Ensures proper error responses

5. **Large Audio Data**
   - Tests size limit enforcement (>5MB)
   - Validates request size validation

6. **Conversation Tracking**
   - Tests conversation context maintenance
   - Validates thread management across requests

**Voice Test Behavior in CI/CD:**
- Tests are **skipped** when `TEST_ENVIRONMENT=Local` (pipeline default)
- Tests are **skipped** when `SKIP_VOICE_TESTS=true`
- Tests **run normally** in local development with Azure Speech credentials configured
- This prevents pipeline failures due to missing external service dependencies

## Pipeline Integration

### Pull Request Pipeline

```yaml
- stage: FunctionalTestsPR
  displayName: 'Functional Tests (PR)'
  dependsOn: DevBuild
  condition: eq(variables['Build.Reason'], 'PullRequest')
```

**Process:**
1. Builds the API project
2. Starts API in background (`dotnet run`)
3. Waits for API to become available
4. Runs functional tests against local API
5. Publishes test results
6. Stops API service

**Benefits:**
- Validates API changes before merging
- Catches integration issues early
- Provides fast feedback to developers

### Main Branch Pipeline

```yaml
- stage: FunctionalTestsDev
  displayName: 'Functional Tests (Dev Environment)'
  dependsOn: DevDeployApi
  condition: |
    and(
      succeeded(), 
      ne(variables['Build.Reason'], 'PullRequest'),
      eq(variables['Build.SourceBranchName'], 'main')
    )
```

**Process:**
1. Runs after successful deployment to Dev environment
2. Tests against live Azure App Service
3. Validates deployment success
4. Ensures production-like environment works

**Benefits:**
- Validates successful deployment
- Tests in production-like environment
- Catches environment-specific issues
- Provides deployment confidence

## Local Development

### Running Tests Locally

#### Option 1: Using PowerShell Script
```powershell
cd services/tests/functional
.\run-local-tests.ps1
```

#### Option 2: Using VS Code Task
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Tasks: Run Task`
3. Select `run-functional-tests-local`

#### Option 3: Manual Execution
```powershell
# Start API
cd services/api
dotnet run &

# Run tests
cd ../tests/functional
$env:TEST_ENVIRONMENT = "Local"
$env:API_BASE_URL = "http://localhost:5000"
dotnet test
```

### Configuration for Local Development

Set environment variables to customize test execution:

```powershell
$env:TEST_ENVIRONMENT = "Local"           # or "Dev"
$env:API_BASE_URL = "http://localhost:5000"
$env:SKIP_VOICE_TESTS = "false"          # Set to "true" to skip voice tests
```

#### Running Voice Tests Locally

Voice tests require Azure Speech Service credentials configured in `appsettings.Development.json`:

```json
{
  "AzureSpeech": {
    "Key": "your-azure-speech-key",
    "Region": "westus",
    "DefaultVoice": "en-US-AvaMultilingualNeural"
  }
}
```

**To enable voice tests:**
1. Configure Azure Speech Service credentials
2. Remove or set `$env:SKIP_VOICE_TESTS = "false"`
3. Do not set `TEST_ENVIRONMENT=Local` (use `Dev` or omit)

**To skip voice tests:**
- Set `$env:SKIP_VOICE_TESTS = "true"`, OR
- Set `$env:TEST_ENVIRONMENT = "Local"`

Voice tests are automatically skipped in CI/CD pipelines where credentials are not configured.

## Adding New Tests

### Guidelines

1. **Follow Naming Convention**
   ```csharp
   [Fact]
   public async Task MethodName_WithCondition_ExpectedBehavior()
   ```

2. **Use Proper Assertions**
   ```csharp
   Assert.Equal(HttpStatusCode.OK, response.StatusCode);
   Assert.NotNull(agentResponse.ResponseText);
   ```

3. **Test Both Success and Error Cases**
   - Include positive test cases
   - Include negative test cases
   - Test edge conditions

4. **Validate Response Structure**
   ```csharp
   var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
   Assert.NotNull(agentResponse);
   Assert.NotNull(agentResponse.ResponseText);
   ```

### Example Test Structure

```csharp
[Fact]
public async Task NewEndpoint_WithValidInput_ReturnsSuccess()
{
    // Arrange
    var request = new RequestModel
    {
        Property = "value"
    };
    var json = JsonConvert.SerializeObject(request);
    var content = new StringContent(json, Encoding.UTF8, "application/json");

    // Act
    var response = await _httpClient.PostAsync("/api/endpoint", content);

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    
    var responseContent = await response.Content.ReadAsStringAsync();
    var result = JsonConvert.DeserializeObject<ResponseModel>(responseContent);
    
    Assert.NotNull(result);
    Assert.Equal("expected", result.Property);
}
```

## Testing Best Practices

### HTTP Client Configuration
- Configure appropriate timeouts
- Set proper headers (User-Agent, etc.)
- Handle authentication if required

### Error Handling
- Test all expected error conditions
- Validate error response formats
- Ensure proper HTTP status codes

### Test Isolation
- Each test should be independent
- Use unique data where possible
- Clean up test data if required

### Performance Considerations
- Tests should complete in reasonable time
- Use appropriate timeouts
- Consider test execution order

## Troubleshooting

### Common Issues

1. **API Not Starting**
   ```
   ❌ API failed to start or is not responding
   ```
   - Check if port 5000 is available
   - Verify API project builds successfully
   - Check for missing dependencies

2. **Test Timeouts**
   ```
   HttpRequestException: The request timed out
   ```
   - Increase timeout in configuration
   - Check network connectivity
   - Verify API is responding

3. **Authentication Errors**
   ```
   401 Unauthorized
   ```
   - Add authentication headers if required
   - Check API authentication configuration

### Debugging

1. **Enable Verbose Logging**
   ```powershell
   dotnet test --logger "console;verbosity=detailed"
   ```

2. **Check API Logs**
   ```powershell
   # When running locally
   dotnet run --project services/api/GamerUncle.Api.csproj
   ```

3. **Test Individual Scenarios**
   ```powershell
   dotnet test --filter "MethodName"
   ```

## Future Enhancements

### Planned Improvements

1. **Authentication Testing**
   - Add tests for authenticated endpoints
   - Test different user roles and permissions

2. **Data Validation**
   - Add schema validation for responses
   - Test data consistency

3. **Performance Testing**
   - Add load testing capabilities
   - Monitor response times

4. **Cross-Environment Testing**
   - Add staging environment tests
   - Support for multiple test environments

5. **Test Data Management**
   - Implement test data seeding
   - Add cleanup procedures

### Integration Opportunities

1. **Monitoring Integration**
   - Send test results to monitoring systems
   - Alert on test failures

2. **Reporting Enhancements**
   - Generate detailed test reports
   - Track test metrics over time

3. **CI/CD Improvements**
   - Parallel test execution
   - Conditional test execution based on changes
