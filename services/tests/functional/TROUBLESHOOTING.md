# Functional Tests Troubleshooting Guide

## Common Issues and Solutions

### 1. "Connection refused (localhost:5000)" in Pipeline

**Problem**: Tests fail with connection refused errors in Azure DevOps pipeline.

**Root Cause**: API server not starting or not ready when tests begin.

**Solution**: 
- The pipeline has been updated to use a single job that starts the API and runs tests sequentially
- Added better health checking with multiple retry attempts
- Added explicit URL binding for the API server

### 2. Tests Pass Locally But Fail in Pipeline

**Problem**: Tests work on developer machine but fail in CI/CD.

**Possible Causes**:
- Different environment (Linux vs Windows)
- Port conflicts in CI environment
- Missing dependencies in CI
- Different timeout values needed

**Solutions**:
- Check pipeline logs for specific error messages
- Ensure all dependencies are restored in pipeline
- Verify environment variables are set correctly
- Consider increasing timeout values for CI environment

### 3. API Takes Too Long to Start

**Problem**: API doesn't respond within expected timeframe.

**Current Settings**:
- Initial wait: 15 seconds
- Health check attempts: 24 (every 5 seconds = 2 minutes total)

**To Adjust**:
```yaml
# In pipeline YAML, modify these values:
sleep 15          # Initial wait time
for i in {1..24}  # Number of attempts
sleep 5           # Time between attempts
```

### 4. Intermittent Test Failures

**Problem**: Tests sometimes pass, sometimes fail.

**Common Causes**:
- Network timeouts
- Resource contention in CI
- Race conditions between API startup and tests

**Solutions**:
- Added retry logic in health checks
- Improved test logging with ITestOutputHelper
- Added smoke tests to verify basic connectivity

### 5. Missing Dependencies in CI

**Problem**: Tests fail due to missing packages or SDK.

**Check**:
- Ensure .NET 8 SDK is properly installed
- Verify NuGet packages are restored
- Check project references are correct

### 6. Environment-Specific Configuration Issues

**Problem**: Tests work in one environment but not another.

**Configuration Files**:
- `appsettings.json` - Base configuration
- `appsettings.local.json` - Local development
- `appsettings.dev.json` - Dev environment

**Environment Variables**:
- `TEST_ENVIRONMENT` - Which config to use
- `API_BASE_URL` - Override base URL

## Debugging Steps

### 1. Check Pipeline Logs

Look for these key indicators:
```
✅ API is responding
⏳ Waiting for API... attempt X/24
❌ API failed to start
```

### 2. Verify API Startup

Check if these steps complete successfully:
1. Restore API Dependencies
2. Build API Project
3. Start API Service
4. Health Check Passes

### 3. Test Locally

```powershell
# Run the same pipeline steps locally
cd services/api
dotnet run --urls "http://localhost:5000" &

# In another terminal
cd services/tests/functional
$env:TEST_ENVIRONMENT = "Local"
$env:API_BASE_URL = "http://localhost:5000"
dotnet test --logger "console;verbosity=normal"
```

### 4. Use Test Output for Debugging

Tests now include detailed logging:
```csharp
_output.WriteLine($"Testing API connectivity at: {_fixture.Configuration.BaseUrl}");
_output.WriteLine($"Response status: {response.StatusCode}");
```

## Pipeline Configuration

### Current PR Pipeline Flow

```yaml
1. Restore API Dependencies
2. Build API Project  
3. Restore Functional Test Dependencies
4. Build Functional Tests
5. Start API in Background (with health checks)
6. Run Functional Tests
7. Stop API Service
8. Publish Test Results
```

### Key Improvements Made

1. **Single Job**: Combined API startup and test execution
2. **Better Health Checks**: Multiple endpoints, longer timeouts
3. **Explicit URL Binding**: `--urls "http://localhost:5000"`
4. **Enhanced Logging**: Test output helpers for debugging
5. **Robust Cleanup**: Ensure API process is killed
6. **Smoke Tests**: Basic connectivity verification

## When to Update This Guide

- After making changes to pipeline configuration
- When encountering new types of failures
- After adding new test scenarios
- When CI environment changes

## Getting Help

If issues persist:
1. Check the full pipeline logs
2. Review test output for specific error messages
3. Verify API functionality independently
4. Check for recent changes to dependencies or configuration
5. Consider running tests against a known-good environment
