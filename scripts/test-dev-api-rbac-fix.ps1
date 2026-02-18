#!/usr/bin/env pwsh
# Test Dev API RBAC Fix - Verify /api/recommendations endpoint works

$ErrorActionPreference = "Stop"

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "Test Dev API RBAC Fix" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$DevApiUrl = "https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
$EndpointUrl = "$DevApiUrl/api/recommendations"

Write-Host "Testing endpoint: $EndpointUrl`n" -ForegroundColor Yellow

# Test payload
$body = @{
    query = "What are some good strategy games for 2-4 players?"
    conversationId = $null
} | ConvertTo-Json

Write-Host "Sending test request..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $EndpointUrl `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    Write-Host "`nSUCCESS!" -ForegroundColor Green
    Write-Host "Status: 200 OK" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Cyan
    
    if ($response.recommendation) {
        $recLength = [Math]::Min(200, $response.recommendation.Length)
        Write-Host "Recommendation: $($response.recommendation.Substring(0, $recLength))..." -ForegroundColor Gray
    } else {
        Write-Host "Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    }
    
    if ($response.conversationId) {
        Write-Host "Conversation ID: $($response.conversationId)" -ForegroundColor Gray
    }
    
    Write-Host "`n✅ RBAC fix verified - API is working correctly!" -ForegroundColor Green
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 401) {
        Write-Host "`n❌ FAILED - Still getting 401 Unauthorized" -ForegroundColor Red
        Write-Host "The RBAC role may need more time to propagate." -ForegroundColor Yellow
        Write-Host "Wait another 2-3 minutes and try again." -ForegroundColor Yellow
    }
    elseif ($statusCode -eq 429) {
        Write-Host "`n⚠️  Rate limit reached (429)" -ForegroundColor Yellow
        Write-Host "This means the API is working, but you've hit the rate limit." -ForegroundColor Cyan
        Write-Host "✅ RBAC fix is working!" -ForegroundColor Green
    }
    else {
        Write-Host "`n❌ Request failed with status code: $statusCode" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
    }
    
    exit 1
}

Write-Host "`nTest complete!`n" -ForegroundColor Cyan
