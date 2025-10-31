#!/usr/bin/env pwsh
# Test Prod API to see if it works

$ErrorActionPreference = "Continue"

$ProdApiUrl = "https://gamer-uncle-prod-app-svc.azurewebsites.net"
$EndpointUrl = "$ProdApiUrl/api/recommendations"

$body = @{
    query = "What are some good strategy games for 2 players?"
    conversationId = $null
} | ConvertTo-Json

Write-Host "Testing PROD API: $EndpointUrl`n" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $EndpointUrl `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    if ($response.responseText -match "Something went wrong.*401") {
        Write-Host "❌ PROD has the same 401 issue!" -ForegroundColor Red
    } else {
        Write-Host "✅ PROD is working correctly!" -ForegroundColor Green
        Write-Host "Response preview: $($response.responseText.Substring(0, [Math]::Min(150, $response.responseText.Length)))..." -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Error testing PROD: $_" -ForegroundColor Red
}
