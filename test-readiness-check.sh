#!/bin/bash

# Script to test API readiness check logic (for pipeline validation)

echo "🔍 Testing API readiness check logic..."

# Test function to simulate readiness check
test_api_readiness() {
    local api_url=$1
    local max_attempts=${2:-5}
    local attempt=1
    
    echo "Testing readiness check for: $api_url"
    
    while [ $attempt -le $max_attempts ]; do
        echo "Checking API health... attempt $attempt/$max_attempts"
        
        # Check if the API is responding to basic requests
        if curl -f -s --max-time 10 "$api_url/" > /dev/null 2>&1; then
            echo "✅ API root endpoint is responding"
            
            # Check if health endpoint is working
            if curl -f -s --max-time 15 "$api_url/health" > /dev/null 2>&1; then
                echo "✅ API health endpoint is responding"
                return 0
            else
                echo "⚠️ Health endpoint not ready yet (attempt $attempt/$max_attempts)"
            fi
        else
            echo "⚠️ API not responding yet (attempt $attempt/$max_attempts)"
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ API failed to become ready after $max_attempts attempts"
            return 1
        fi
        
        echo "Waiting 2 seconds before retry..."
        sleep 2
        attempt=$((attempt + 1))
    done
}

# Test with dev API (should be accessible)
echo "Testing Dev API readiness check..."
if test_api_readiness "https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net" 3; then
    echo "✅ Dev API readiness check passed"
else
    echo "⚠️ Dev API readiness check failed (this may be expected if API is down)"
fi

echo ""
echo "Testing Prod API readiness check..."
if test_api_readiness "https://gamer-uncle-prod-app-svc.azurewebsites.net" 3; then
    echo "✅ Prod API readiness check passed"
else
    echo "⚠️ Prod API readiness check failed (this may be expected if API is down)"
fi

echo ""
echo "🧪 Readiness check logic validation complete"
