#!/bin/bash

# Comprehensive E2E Test Runner for Gamer Uncle
# Supports PR testing (against local) and CD testing (against deployed environments)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎲 Gamer Uncle E2E Test Runner${NC}"

# Determine test environment
TEST_ENV=${TEST_ENVIRONMENT:-"local"}
BUILD_REASON=${BUILD_REASON:-""}
SOURCE_BRANCH=${BUILD_SOURCEBRANCH:-""}

echo "Test Environment: $TEST_ENV"
echo "Build Reason: $BUILD_REASON"
echo "Source Branch: $SOURCE_BRANCH"

# Function to check if a URL is accessible
check_url() {
    local url=$1
    local description=$2
    local max_retries=30
    local retry_count=0
    
    echo "⏳ Checking $description at $url..."
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s --head --request GET "$url" | head -n 1 | grep -q "200 OK\|404"; then
            echo -e "${GREEN}✅ $description is accessible${NC}"
            return 0
        fi
        
        echo "Attempt $((retry_count + 1))/$max_retries failed, retrying in 10s..."
        sleep 10
        retry_count=$((retry_count + 1))
    done
    
    echo -e "${RED}❌ $description failed to become accessible after $max_retries attempts${NC}"
    return 1
}

# Configure environment-specific settings
configure_environment() {
    case $TEST_ENV in
        "local"|"pr")
            echo -e "${YELLOW}🏠 Configuring for local testing${NC}"
            export E2E_BASE_URL="http://localhost:8081"
            export API_BASE_URL="https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
            
            # Check if API is accessible
            if ! check_url "$API_BASE_URL/api" "API Service"; then
                echo -e "${YELLOW}⚠️  API not accessible, tests may have limited functionality${NC}"
            fi
            ;;
            
        "dev")
            echo -e "${YELLOW}🌐 Configuring for dev environment testing${NC}"
            export E2E_BASE_URL="https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
            export API_BASE_URL="https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
            
            # Check if both app and API are accessible
            if ! check_url "$E2E_BASE_URL" "Mobile App"; then
                echo -e "${RED}❌ Mobile app not accessible, cannot proceed${NC}"
                exit 1
            fi
            
            if ! check_url "$API_BASE_URL/api" "API Service"; then
                echo -e "${RED}❌ API not accessible, tests will likely fail${NC}"
                exit 1
            fi
            ;;
            
        "staging")
            echo -e "${YELLOW}🚀 Configuring for staging environment testing${NC}"
            export E2E_BASE_URL="https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
            export API_BASE_URL="https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
            ;;
            
        "prod"|"production")
            echo -e "${GREEN}🚀 Configuring for production environment testing${NC}"
            export E2E_BASE_URL="https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net"
            export API_BASE_URL="https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net"
            ;;
            
        *)
            echo -e "${RED}❌ Unknown test environment: $TEST_ENV${NC}"
            exit 1
            ;;
    esac
    
    echo "E2E Base URL: $E2E_BASE_URL"
    echo "API Base URL: $API_BASE_URL"
}

# Install dependencies
install_dependencies() {
    echo -e "${BLUE}📦 Installing dependencies${NC}"
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found${NC}"
        exit 1
    fi
    
    npm install
    
    echo -e "${BLUE}🎭 Installing Playwright browsers${NC}"
    npx playwright install --with-deps
}

# Select test suites based on environment and build reason
select_test_suites() {
    if [ "$BUILD_REASON" = "PullRequest" ]; then
        echo -e "${BLUE}🔍 Running PR test suite (focused tests)${NC}"
        export TEST_PATTERN="**/*{chat,landing,complete-suite}.spec.ts"
    elif [ "$TEST_ENV" = "dev" ]; then
        echo -e "${BLUE}🌐 Running full dev environment test suite${NC}"
        export TEST_PATTERN="**/*.spec.ts"
    else
        echo -e "${BLUE}🧪 Running standard test suite${NC}"
        export TEST_PATTERN="**/*.spec.ts"
    fi
    
    echo "Test pattern: $TEST_PATTERN"
}

# Run tests with appropriate configuration
run_tests() {
    echo -e "${BLUE}🧪 Running E2E tests${NC}"
    
    # Determine reporter based on environment
    if [ "$CI" = "true" ]; then
        REPORTER_CONFIG="--reporter=junit --output-dir=test-results"
    else
        REPORTER_CONFIG="--reporter=html"
    fi
    
    # Set timeout based on environment
    if [ "$TEST_ENV" = "dev" ] || [ "$TEST_ENV" = "staging" ]; then
        TIMEOUT_CONFIG="--timeout=120000" # 2 minutes for remote environments
    else
        TIMEOUT_CONFIG="--timeout=60000"  # 1 minute for local
    fi
    
    # Run tests with retry logic for remote environments
    local max_attempts=1
    if [ "$TEST_ENV" != "local" ]; then
        max_attempts=2
    fi
    
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        echo "Test attempt $attempt/$max_attempts"
        
        if npx playwright test $REPORTER_CONFIG $TIMEOUT_CONFIG --grep="$TEST_PATTERN"; then
            echo -e "${GREEN}✅ Tests passed${NC}"
            return 0
        elif [ $attempt -eq $max_attempts ]; then
            echo -e "${RED}❌ Tests failed after $max_attempts attempts${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  Test attempt $attempt failed, retrying...${NC}"
            sleep 30
        fi
        
        attempt=$((attempt + 1))
    done
}

# Generate test reports
generate_reports() {
    echo -e "${BLUE}📊 Generating test reports${NC}"
    
    if [ -d "test-results" ]; then
        # Create summary report
        cat > test-results/summary.txt << EOF
Gamer Uncle E2E Test Summary
============================
Test Environment: $TEST_ENV
Build Reason: $BUILD_REASON
Test URL: $E2E_BASE_URL
API URL: $API_BASE_URL
Test Pattern: $TEST_PATTERN
Timestamp: $(date)
============================
EOF
        
        echo -e "${GREEN}✅ Test summary created${NC}"
        
        # Show test results summary
        if [ -f "test-results/junit-results.xml" ]; then
            echo "Test results available in: test-results/junit-results.xml"
        fi
        
        if [ -d "test-results/html-report" ]; then
            echo "HTML report available in: test-results/html-report/index.html"
        fi
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Starting E2E test execution...${NC}"
    
    configure_environment
    install_dependencies
    select_test_suites
    
    if run_tests; then
        generate_reports
        echo -e "${GREEN}🎉 E2E tests completed successfully!${NC}"
        exit 0
    else
        generate_reports
        echo -e "${RED}💥 E2E tests failed!${NC}"
        exit 1
    fi
}

# Execute main function
main "$@"
