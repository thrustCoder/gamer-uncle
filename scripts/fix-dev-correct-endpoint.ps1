#!/usr/bin/env pwsh
# Update Dev endpoint to correct AI Foundry API endpoint

$ErrorActionPreference = "Stop"

$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"
$CorrectEndpoint = "https://gamer-uncle-dev-foundry.services.ai.azure.com/api/projects/gamer-uncle-dev-foundry-project"

Write-Host "Updating to CORRECT AI Foundry endpoint...`n" -ForegroundColor Cyan

az webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroup `
    --settings "AgentService__Endpoint=$CorrectEndpoint" `
    | Out-Null

Write-Host "✅ Updated to correct endpoint" -ForegroundColor Green
Write-Host "   Endpoint: $CorrectEndpoint`n" -ForegroundColor Gray

az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
Write-Host "✅ Restarted App Service`n" -ForegroundColor Green

Write-Host "✅ Dev App Service now has correct endpoint!" -ForegroundColor Green
Write-Host "Wait 45 seconds, then test...`n" -ForegroundColor Cyan
