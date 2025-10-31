#!/usr/bin/env pwsh
# Update Dev endpoint to use westus3

$ErrorActionPreference = "Stop"

$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"
$CorrectEndpoint = "https://gamer-uncle-dev-foundry-westus3.services.ai.azure.com/api/projects/gamer-uncle-dev-foundry-project"

Write-Host "Updating to westus3 endpoint...`n" -ForegroundColor Cyan

az webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroup `
    --settings "AgentService__Endpoint=$CorrectEndpoint" `
    | Out-Null

Write-Host "✅ Updated to westus3 endpoint" -ForegroundColor Green

az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
Write-Host "✅ Restarted`n" -ForegroundColor Green
