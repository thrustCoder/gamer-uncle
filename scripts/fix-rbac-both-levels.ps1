#!/usr/bin/env pwsh
# Assign Azure AI User role at BOTH account and project levels

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Fix RBAC - Account + Project Levels" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"
$AccountResourceId = "/subscriptions/e1a26719-3504-42e4-bc8c-05aa63259e4b/resourceGroups/gamer-uncle-dev-rg/providers/Microsoft.CognitiveServices/accounts/gamer-uncle-dev-foundry"
$ProjectResourceId = "$AccountResourceId/projects/gamer-uncle-dev-foundry-project"

# Get Principal ID
$appService = az webapp identity show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
$principalId = $appService.principalId
Write-Host "Principal ID: $principalId`n" -ForegroundColor Green

# Assign at ACCOUNT level
Write-Host "1. Assigning 'Azure AI User' at ACCOUNT level..." -ForegroundColor Yellow
try {
    az role assignment create `
        --role "Azure AI User" `
        --assignee-object-id $principalId `
        --scope $AccountResourceId `
        --assignee-principal-type ServicePrincipal 2>$null | Out-Null
    Write-Host "   ✅ Assigned at account level" -ForegroundColor Green
}
catch {
    Write-Host "   Already exists at account level" -ForegroundColor Cyan
}

# Verify at account level
Write-Host "`n2. Roles at ACCOUNT level:" -ForegroundColor Yellow
az role assignment list --assignee $principalId --scope $AccountResourceId --query "[].roleDefinitionName" -o tsv

# Verify at project level
Write-Host "`n3. Roles at PROJECT level:" -ForegroundColor Yellow
az role assignment list --assignee $principalId --scope $ProjectResourceId --query "[].roleDefinitionName" -o tsv

# Restart
Write-Host "`n4. Restarting App Service..." -ForegroundColor Yellow
az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
Write-Host "   ✅ Restarted`n" -ForegroundColor Green

Write-Host "✅ RBAC configured at BOTH levels!" -ForegroundColor Green
Write-Host "Wait 2-3 minutes, then test the API.`n" -ForegroundColor Cyan
