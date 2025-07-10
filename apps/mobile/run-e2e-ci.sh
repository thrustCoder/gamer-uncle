#!/bin/bash
set -e

echo "🚀 Starting E2E Tests Setup..."

# Set CI-specific environment variables
export NODE_ENV=test
export CI=true

# Ensure we're in the correct directory
cd "$(dirname "$0")"

echo "📂 Current directory: $(pwd)"
echo "🌐 Base URL: ${E2E_BASE_URL:-https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net}"

# Install Playwright browsers if not already installed
echo "🎭 Installing Playwright browsers..."
if npx playwright install --with-deps chromium; then
  echo "✅ Playwright browsers installed successfully"
else
  echo "❌ Failed to install Playwright browsers"
  exit 1
fi

# Verify the target URL is accessible (only if E2E_BASE_URL is set)
if [ -n "$E2E_BASE_URL" ]; then
    echo "🔍 Checking if target URL is accessible..."
    if curl -f -s --max-time 15 --retry 2 "$E2E_BASE_URL" > /dev/null; then
        echo "✅ Target URL is accessible: $E2E_BASE_URL"
    else
        echo "⚠️ Target URL check failed: $E2E_BASE_URL"
        echo "🔧 Continuing with localhost fallback..."
        unset E2E_BASE_URL
    fi
fi

# Run tests with timeout protection
echo "🧪 Running E2E tests..."

# Initialize exit code
exit_code=0

# Set shorter timeout for CI to prevent hanging
timeout_duration="30m"

# For macOS/Linux compatibility, use different timeout commands
if command -v gtimeout >/dev/null 2>&1; then
    # Use gtimeout on macOS (from coreutils package)
    gtimeout $timeout_duration npx playwright test --reporter=junit,line,github || exit_code=$?
elif command -v timeout >/dev/null 2>&1; then
    # Use timeout on Linux
    timeout $timeout_duration npx playwright test --reporter=junit,line,github || exit_code=$?
else
    # Fallback: run without timeout (relying on Playwright's own timeouts)
    echo "⚠️  Timeout command not available, relying on Playwright timeouts..."
    npx playwright test --reporter=junit,line,github || exit_code=$?
fi

if [ $exit_code -ne 0 ]; then
    echo "❌ E2E tests failed or timed out (exit code: $exit_code)"
    
    # Try to save any available reports for debugging
    echo "📋 Gathering diagnostic information..."
    
    if [ -d "playwright-report" ]; then
        echo "📋 Playwright report directory exists"
        ls -la playwright-report/ 2>/dev/null || true
    else
        echo "⚠️ No playwright-report directory found"
    fi
    
    if [ -f "test-results/junit-results.xml" ]; then
        echo "📊 JUnit results file exists"
        ls -la test-results/junit-results.xml 2>/dev/null || true
    else
        echo "⚠️ No JUnit results file found"
    fi
    
    # List any test results that were created
    if [ -d "test-results" ]; then
        echo "📁 Test results directory contents:"
        ls -la test-results/ 2>/dev/null || true
    fi
    
    exit $exit_code
fi

echo "✅ E2E tests completed successfully!"
echo "📊 Test artifacts:"
[ -d "test-results" ] && ls -la test-results/ || echo "No test-results directory"
[ -d "playwright-report" ] && echo "Playwright report available" || echo "No playwright-report directory"
