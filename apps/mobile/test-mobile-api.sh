#!/usr/bin/env bash

echo "🔍 Testing Mobile App API Endpoints"
echo "=================================="

# Test endpoints with mobile-like headers
DEV_API="https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api"

echo "1. Testing Voice Sessions Endpoint:"
echo "POST $DEV_API/voice/sessions"

curl -X POST "$DEV_API/voice/sessions" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Gamer-Uncle/2.1.19 iOS/17.0" \
  -H "Accept: application/json" \
  -d '{
    "Query": "Tell me about a board game",
    "ConversationId": "test-conversation-voice",
    "UserId": "test-user-mobile"
  }' \
  -w "\n✅ Voice HTTP Status: %{http_code} | Response Time: %{time_total}s\n\n" \
  -s

echo -e "\n2. Testing Regular Chat Endpoint:"
echo "POST $DEV_API/recommendations"

curl -X POST "$DEV_API/recommendations" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Gamer-Uncle/2.1.19 iOS/17.0" \
  -H "Accept: application/json" \
  -d '{
    "Query": "Recommend a strategy game",
    "ConversationId": "test-conversation-chat",
    "UserId": "test-user-mobile"
  }' \
  -w "\n✅ Chat HTTP Status: %{http_code} | Response Time: %{time_total}s\n\n" \
  -s

echo -e "\n3. Testing Rate Limiting with Multiple Requests:"
for i in {1..3}; do
  echo "Request $i:"
  curl -X POST "$DEV_API/recommendations" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Gamer-Uncle/2.1.19 iOS/17.0" \
    -d '{"Query": "Quick test '$i'", "ConversationId": "rate-test"}' \
    -w "HTTP: %{http_code} | Time: %{time_total}s\n" \
    -s
  sleep 1
done