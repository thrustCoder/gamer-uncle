#!/bin/bash

# GamerUncle API Functional Tests - Local Testing Script

echo "🎯 GamerUncle API Functional Tests"
echo "=================================="

# Check if API project exists
API_PROJECT="../../api/GamerUncle.Api.csproj"
if [ ! -f "$API_PROJECT" ]; then
    echo "❌ API project not found at $API_PROJECT"
    exit 1
fi

# Start API in background
echo "🚀 Starting API server..."
dotnet run --project "$API_PROJECT" &
API_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    kill $API_PID 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Setup trap for cleanup
trap cleanup EXIT

# Wait for API to start
echo "⏳ Waiting for API to start..."
sleep 10

# Test if API is responding
for i in {1..12}; do
    if curl -f http://localhost:5000/ 2>/dev/null || curl -f http://localhost:5000/api/recommendations 2>/dev/null; then
        echo "✅ API is responding"
        break
    fi
    echo "⏳ Waiting for API... attempt $i/12"
    sleep 5
done

# Check if API is still not responding
if ! curl -f http://localhost:5000/ 2>/dev/null && ! curl -f http://localhost:5000/api/recommendations 2>/dev/null; then
    echo "❌ API failed to start or is not responding"
    exit 1
fi

# Set test environment
export TEST_ENVIRONMENT=Local
export API_BASE_URL=http://localhost:5000

# Run functional tests
echo "🧪 Running functional tests..."
dotnet test --logger "console;verbosity=normal"

# Get test result
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ All functional tests passed!"
else
    echo "❌ Some functional tests failed!"
fi

exit $TEST_RESULT
