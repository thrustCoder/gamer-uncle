# E2E Test Timeout Fix Documentation

## Problem

The E2E tests were hanging and timing out in CI after nearly an hour, causing build failures. The main issues identified were:

1. **WebServer Configuration**: Trying to start local server in CI environment
2. **Long Timeout Values**: Excessive timeouts causing tests to hang
3. **Browser Configuration**: Running too many browsers in CI
4. **Missing CI Optimizations**: No CI-specific configuration

## Solution

### 1. Updated Playwright Configuration (`playwright.config.ts`)

#### WebServer Configuration

- **Before**: Always tried to start local server unless `E2E_BASE_URL` was set
- **After**: Skips webServer in CI environment OR when `E2E_BASE_URL` is set
- **Benefit**: Prevents hanging on server startup in CI

#### Base URL Configuration

- **Before**: Used localhost as fallback
- **After**: Uses dev environment URL in CI when no custom URL is provided
- **Benefit**: Tests can run against deployed environment in CI

#### Timeout Optimizations

- **Test Timeout**: 30s in CI vs 60s in dev
- **Expect Timeout**: 5s in CI vs 10s in dev  
- **Action Timeout**: 15s in CI vs 30s in dev
- **Navigation Timeout**: 30s in CI vs 60s in dev
- **WebServer Timeout**: 60s vs previous 120s

#### Browser Configuration

- **CI**: Only runs Chromium for speed
- **Development**: Runs all browsers (Chrome, Firefox, Safari, Mobile)

### 2. CI-Specific Script (`run-e2e-ci.sh`)

New script with additional safeguards:

- Installs only required browser (Chromium)
- Verifies target URL accessibility
- Uses `timeout` command for hard limit (45 minutes)
- Better error handling and diagnostics
- Saves reports even on failure

### 3. Updated Test Data (`e2e/test-data.ts`)

Environment-aware timeouts:

- **API_RESPONSE**: 20s in CI vs 45s in dev
- **PAGE_LOAD**: 8s in CI vs 15s in dev
- **MESSAGE_APPEAR**: 8s in CI vs 15s in dev
- **TYPING_INDICATOR**: 3s in CI vs 5s in dev

### 4. New Smoke Test (`e2e/smoke.spec.ts`)

Basic connectivity test that:

- Runs first to verify environment
- Has shorter timeouts
- Provides diagnostic information
- Takes screenshots for debugging

## Usage

### For CI/Pipeline

Use the new CI script:

```bash
npm run test:e2e:ci
```

Or set environment variables:

```bash
export CI=true
export E2E_BASE_URL=https://your-app.azurewebsites.net
npm run test:e2e
```

### For Development

Continue using existing commands:

```bash
npm run test:e2e              # Regular tests
npm run test:e2e:headed       # With browser UI
npm run test:e2e:debug        # Debug mode
```

### For Specific Environment

```bash
E2E_BASE_URL=https://staging.example.com npm run test:e2e
```

## Configuration Variables

| Variable | CI Value | Dev Value | Purpose |
|----------|----------|-----------|---------|
| `E2E_BASE_URL` | Auto-detected or custom | `http://localhost:8081` | Target URL |
| `CI` | `true` | `undefined` | Enables CI optimizations |
| Test timeout | 30s | 60s | Per-test limit |
| API timeout | 20s | 45s | API response wait |
| Browsers | Chromium only | All browsers | Test coverage vs speed |

## Monitoring

The changes include better logging and diagnostics:

- URL accessibility checks
- Screenshot capture on failures
- Console logging for debugging
- JUnit and GitHub reporters for CI

## Expected Behavior

- **CI Tests**: Should complete in 5-15 minutes instead of timing out
- **Development**: Minimal impact, slightly faster due to reduced webServer timeout
- **Error Cases**: Better error messages and diagnostic information

## Rollback Plan

If issues arise, you can:

1. Use the legacy CI command: `npm run test:e2e:ci-legacy`
2. Revert the `playwright.config.ts` timeout changes
3. Set `E2E_BASE_URL` manually to bypass webServer logic

## Next Steps

1. Monitor CI build times after deployment
2. Adjust timeouts based on actual performance data
3. Consider adding test parallelization if needed
4. Add more smoke tests for critical paths
