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
npx playwright install --with-deps chromium

# Verify the target URL is accessible
if [ -n "$E2E_BASE_URL" ]; then
    echo "🔍 Checking if target URL is accessible..."
    curl -f -s --max-time 30 "$E2E_BASE_URL" > /dev/null || {
        echo "❌ Target URL is not accessible: $E2E_BASE_URL"
        echo "🔧 Falling back to localhost..."
        unset E2E_BASE_URL
    }
fi

# Run tests with timeout protection
echo "🧪 Running E2E tests..."

# Initialize exit code
exit_code=0

# For macOS/Linux compatibility, use different timeout commands
if command -v gtimeout >/dev/null 2>&1; then
    # Use gtimeout on macOS (from coreutils package)
    gtimeout 45m npx playwright test --reporter=junit,line,github || exit_code=$?
elif command -v timeout >/dev/null 2>&1; then
    # Use timeout on Linux
    timeout 45m npx playwright test --reporter=junit,line,github || exit_code=$?
else
    # Fallback: run without timeout (relying on Playwright's own timeouts)
    echo "⚠️  Timeout command not available, relying on Playwright timeouts..."
    npx playwright test --reporter=junit,line,github || exit_code=$?
fi

if [ $exit_code -ne 0 ]; then
    echo "❌ E2E tests failed or timed out (exit code: $exit_code)"
    
    # Try to save any available reports
    if [ -d "playwright-report" ]; then
        echo "📋 Playwright report directory exists"
        ls -la playwright-report/ || true
    fi
    
    if [ -f "test-results/junit-results.xml" ]; then
        echo "📊 JUnit results file exists"
        ls -la test-results/junit-results.xml || true
    fi
    
    exit $exit_code
fi

echo "✅ E2E tests completed successfully!"
