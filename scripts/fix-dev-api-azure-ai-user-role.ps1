#!/usr/bin/env pwsh
# Fix RBAC with the correct Azure AI User role at PROJECT level

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Fix Dev API Foundry - Azure AI User Role" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Configuration
$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"
$ProjectResourceId = "/subscriptions/e1a26719-3504-42e4-bc8c-05aa63259e4b/resourceGroups/gamer-uncle-dev-rg/providers/Microsoft.CognitiveServices/accounts/gamer-uncle-dev-foundry/projects/gamer-uncle-dev-foundry-project"

# Step 1: Get Principal ID
Write-Host "1. Getting App Service Managed Identity..." -ForegroundColor Yellow
$appService = az webapp identity show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
$principalId = $appService.principalId
Write-Host "   Principal ID: $principalId" -ForegroundColor Green

# Step 2: Check current roles
Write-Host "`n2. Current role assignments at project level:" -ForegroundColor Yellow
az role assignment list --assignee $principalId --scope $ProjectResourceId --query "[].{Role:roleDefinitionName, Scope:scope}" -o table

# Step 3: Assign Azure AI User role (ID: 53ca6127-db72-4b80-b1b0-d745d6d5456d)
Write-Host "`n3. Assigning 'Azure AI User' role at PROJECT level..." -ForegroundColor Yellow
try {
    az role assignment create `
        --role "Azure AI User" `
        --assignee-object-id $principalId `
        --scope $ProjectResourceId `
        --assignee-principal-type ServicePrincipal | Out-Null
    
    Write-Host "   Successfully assigned 'Azure AI User' role" -ForegroundColor Green
}
catch {
    Write-Host "   Role may already exist: $_" -ForegroundColor Yellow
}

# Step 4: Verify
Write-Host "`n4. Verifying role assignments..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
az role assignment list --assignee $principalId --scope $ProjectResourceId --query "[].{Role:roleDefinitionName}" -o table

# Step 5: Restart App Service
Write-Host "`n5. Restarting App Service..." -ForegroundColor Yellow
az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
Write-Host "   App Service restarted" -ForegroundColor Green

Write-Host "`n✅ Azure AI User role applied at PROJECT level!" -ForegroundColor Green
Write-Host "`nWait 2-3 minutes for propagation, then test the API.`n" -ForegroundColor Cyan
