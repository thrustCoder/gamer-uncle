# Test Production Recommendations API
# This script tests the fixed AI Foundry endpoint

$apiUrl = "https://gamer-uncle-prod-app-svc.azurewebsites.net/api/Recommendations"

Write-Host "Testing Production Recommendations API" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Test payload
$testPayload = @{
    query = "I am looking for a new board game."
    userId = "test-user-id"
} | ConvertTo-Json -Depth 10

Write-Host "`nSending test request..." -ForegroundColor Yellow
Write-Host "URL: $apiUrl" -ForegroundColor White
Write-Host "Payload: $testPayload" -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $testPayload -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "`nSuccess!" -ForegroundColor Green
    Write-Host "Response received:" -ForegroundColor Green
    
    if ($response.responseText) {
        Write-Host "ResponseText: $($response.responseText.Substring(0, [Math]::Min(200, $response.responseText.Length)))..." -ForegroundColor White
    }
    
    if ($response.threadId) {
        Write-Host "ThreadId: $($response.threadId)" -ForegroundColor White
    }
    
    if ($response.matchingGamesCount -ne $null) {
        Write-Host "MatchingGamesCount: $($response.matchingGamesCount)" -ForegroundColor White
    }
    
    Write-Host "`nThe 'No such host' error has been resolved!" -ForegroundColor Green
    
} catch {
    Write-Host "`nError occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Message -like "*No such host*") {
        Write-Host "The hostname issue persists. Check DNS resolution." -ForegroundColor Yellow
    } elseif ($_.Exception.Message -like "*timeout*") {
        Write-Host "The request timed out. AI Foundry may be slow to respond." -ForegroundColor Yellow
    } else {
        Write-Host "A different error occurred. Check the error details above." -ForegroundColor Yellow
    }
}
