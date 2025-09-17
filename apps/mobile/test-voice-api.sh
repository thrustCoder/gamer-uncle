#!/usr/bin/env bash

echo "🔍 Testing Voice API Endpoint"
echo "============================="

# Test the production API endpoint that the mobile app is calling
PROD_API="https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api"
DEV_API="https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api"

echo "Testing Production Voice Endpoint:"
echo "POST $PROD_API/voice/sessions"

curl -X POST "$PROD_API/voice/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "Query": "Test voice session",
    "ConversationId": "test-conversation",
    "UserId": "test-user"
  }' \
  -w "\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  -v

echo -e "\n\nTesting Development Voice Endpoint:"
echo "POST $DEV_API/voice/sessions"

curl -X POST "$DEV_API/voice/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "Query": "Test voice session",
    "ConversationId": "test-conversation", 
    "UserId": "test-user"
  }' \
  -w "\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  -v