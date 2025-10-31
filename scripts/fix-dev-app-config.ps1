#!/usr/bin/env pwsh
# Fix Dev App Service configuration to use DEV Foundry endpoint

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Fix Dev App Service Configuration" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"

# Read appsettings.Development.json to get correct endpoint
$DevEndpoint = "https://gamer-uncle-dev-foundry-eastus2.services.ai.azure.com/api/projects/gamer-uncle-dev-foundry-project"
$DevAgentId = "asst_I9OYA4zbMEmjzz84Vo5z4Zm"

Write-Host "Current Configuration (WRONG):" -ForegroundColor Red
az webapp config appsettings list `
    --name $AppServiceName `
    --resource-group $ResourceGroup `
    --query "[?name=='AgentService__Endpoint' || name=='AgentService__AgentId'].{Name:name, Value:value}" `
    -o table

Write-Host "`nUpdating to DEV Foundry endpoint..." -ForegroundColor Yellow

az webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroup `
    --settings "AgentService__Endpoint=$DevEndpoint" "AgentService__AgentId=$DevAgentId" `
    | Out-Null

Write-Host "✅ Configuration updated!`n" -ForegroundColor Green

Write-Host "New Configuration (CORRECT):" -ForegroundColor Green
az webapp config appsettings list `
    --name $AppServiceName `
    --resource-group $ResourceGroup `
    --query "[?name=='AgentService__Endpoint' || name=='AgentService__AgentId'].{Name:name, Value:value}" `
    -o table

Write-Host "`nRestarting App Service..." -ForegroundColor Yellow
az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
Write-Host "✅ Restarted`n" -ForegroundColor Green

Write-Host "✅ Dev App Service now points to DEV Foundry!" -ForegroundColor Green
Write-Host "Wait 1 minute, then test the API.`n" -ForegroundColor Cyan
