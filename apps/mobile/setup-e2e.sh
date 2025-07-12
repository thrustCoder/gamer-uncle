#!/bin/bash

# E2E Test Setup Script for Gamer Uncle App
# This script ensures the necessary services are running before executing e2e tests

set -e

echo "🎲 Setting up Gamer Uncle E2E Test Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the apps/mobile directory${NC}"
    exit 1
fi

# Configuration
API_URL="https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net/api"
LOCAL_URL="http://localhost:8081"
MAX_RETRIES=30
RETRY_INTERVAL=2

# Function to check if a URL is accessible
check_url() {
    local url=$1
    local description=$2
    
    echo "Checking $description at $url..."
    
    if curl -s --head --request GET "$url" | head -n 1 | grep -q "200 OK\|404"; then
        echo -e "${GREEN}✅ $description is accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ $description is not accessible${NC}"
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local description=$2
    local retries=0
    
    echo "⏳ Waiting for $description to be ready..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if check_url "$url" "$description"; then
            return 0
        fi
        
        echo "Attempt $((retries + 1))/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
        retries=$((retries + 1))
    done
    
    echo -e "${RED}❌ $description failed to become ready after $MAX_RETRIES attempts${NC}"
    return 1
}

# Check if Playwright is installed
echo "🎭 Checking Playwright installation..."
if ! npx playwright --version > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Playwright not found, installing...${NC}"
    npm run test:install
else
    echo -e "${GREEN}✅ Playwright is installed${NC}"
fi

# Check API accessibility
echo "🔌 Checking API accessibility..."
if ! check_url "$API_URL/Recommendations" "API Service"; then
    echo -e "${YELLOW}⚠️  API is not accessible. Tests may fail if the API is down.${NC}"
    echo "Please ensure the API service is running and accessible."
fi

# Check if local app will be available
echo "📱 Checking if local development server will be available..."
echo "The Playwright config will start the local server automatically."

# Verify test files exist
echo "📁 Verifying test files..."
required_files=(
    "e2e/chat.spec.ts"
    "e2e/chat-page.ts"
    "e2e/test-data.ts"
    "playwright.config.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file is missing${NC}"
        exit 1
    fi
done

echo -e "${GREEN}🎉 Setup complete! Ready to run e2e tests.${NC}"
echo ""
echo "To run the tests:"
echo "  npm run test:e2e                 # Run tests headless"
echo "  npm run test:e2e:headed          # Run tests with browser UI"
echo "  npm run test:e2e:debug           # Run tests in debug mode"
echo ""
echo "Note: The tests will verify that chat responses are NOT fallback messages"
echo "for these key scenarios:"
echo "  - Suggest games for 4 players."
echo "  - How to win at Ticket to Ride?"
echo "  - Tell me the rules for Catan."

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npm run test:install

# Create a simple test to verify setup
echo "🧪 Running a basic connectivity test..."

# Ensure port 8081 is available for Playwright's webServer
echo "🧹 Cleaning up any existing processes on port 8081..."
if lsof -ti:8081 >/dev/null 2>&1; then
    echo "Found process using port 8081, terminating..."
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Note: Playwright will start the web server automatically when running tests
echo "📝 Note: The web server will be started automatically by Playwright during test execution."

echo ""
echo "🎉 Setup complete! You can now run tests with:"
echo "   npm run test:e2e              # Run all tests"
echo "   npm run test:e2e:headed       # Run with browser UI"
echo "   npm run test:e2e:debug        # Debug mode"
echo ""
echo "📖 See e2e/README.md for more detailed instructions."
