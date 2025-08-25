#!/usr/bin/env pwsh

# Test production API with detailed logging
$productionUrl = "https://gamer-uncle-prod-app-svc.azurewebsites.net/api/Recommendations"
$devUrl = "https://gamer-uncle-dev-app-svc.azurewebsites.net/api/Recommendations"

Write-Host "Testing Gamer Uncle API - Dev vs Prod Comparison" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

$testQuery = @{
    query = "Can you tell me little bit more about Ticket to Ride game?"
    userId = "9fe02a4e-2cb0-4c7a-9f3b-0c4c897cbac2"
} | ConvertTo-Json

Write-Host "`nTesting DEV environment..." -ForegroundColor Yellow
Write-Host "URL: $devUrl" -ForegroundColor Gray

try {
    $devResponse = Invoke-RestMethod -Uri $devUrl -Method Post -Body $testQuery -ContentType "application/json" -ErrorAction Stop
    Write-Host "✅ DEV Response:" -ForegroundColor Green
    Write-Host "Response Length: $($devResponse.responseText.Length)" -ForegroundColor Cyan
    Write-Host "Matching Games: $($devResponse.matchingGamesCount)" -ForegroundColor Cyan
    Write-Host "Thread ID: $($devResponse.threadId)" -ForegroundColor Cyan
    Write-Host "Response Preview: $($devResponse.responseText.Substring(0, [Math]::Min(200, $devResponse.responseText.Length)))" -ForegroundColor White
    
    if ($devResponse.responseText -match "Your query about") {
        Write-Host "⚠️  DEV using fallback response!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ DEV Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "="*50 + "`n" -ForegroundColor Gray

Write-Host "Testing PROD environment..." -ForegroundColor Yellow  
Write-Host "URL: $productionUrl" -ForegroundColor Gray

try {
    $prodResponse = Invoke-RestMethod -Uri $productionUrl -Method Post -Body $testQuery -ContentType "application/json" -ErrorAction Stop
    Write-Host "✅ PROD Response:" -ForegroundColor Green
    Write-Host "Response Length: $($prodResponse.responseText.Length)" -ForegroundColor Cyan
    Write-Host "Matching Games: $($prodResponse.matchingGamesCount)" -ForegroundColor Cyan  
    Write-Host "Thread ID: $($prodResponse.threadId)" -ForegroundColor Cyan
    Write-Host "Response Preview: $($prodResponse.responseText.Substring(0, [Math]::Min(200, $prodResponse.responseText.Length)))" -ForegroundColor White
    
    if ($prodResponse.responseText -match "Your query about") {
        Write-Host "🚨 PROD using fallback response!" -ForegroundColor Red
        Write-Host "This explains the production issue!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ PROD Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nAnalysis:" -ForegroundColor Green
Write-Host "- If PROD shows 'Your query about' pattern, it's using the GenerateEnhancedResponse fallback" -ForegroundColor Gray
Write-Host "- This indicates the Azure AI Agent service is returning low-quality responses in PROD" -ForegroundColor Gray
Write-Host "- Check Application Insights for 'AgentResponse.FallbackUsed' events" -ForegroundColor Gray
