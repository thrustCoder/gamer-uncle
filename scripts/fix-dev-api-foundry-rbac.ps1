#!/usr/bin/env pwsh
# Fix RBAC permissions for Dev API App Service to access Azure AI Foundry Agent Service

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Fix Dev API Foundry RBAC Permissions" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Configuration
$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"
$FoundryName = "gamer-uncle-dev-foundry"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "   Resource Group: $ResourceGroup"
Write-Host "   App Service: $AppServiceName"
Write-Host "   AI Foundry: $FoundryName`n"

# Step 1: Get App Service Managed Identity Principal ID
Write-Host "1. Getting App Service Managed Identity..." -ForegroundColor Yellow
try {
    $appService = az webapp identity show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
    $principalId = $appService.principalId
    
    if ($principalId) {
        Write-Host "   Principal ID: $principalId" -ForegroundColor Green
    }
    else {
        Write-Host "   No managed identity found. Enabling..." -ForegroundColor Red
        az webapp identity assign --name $AppServiceName --resource-group $ResourceGroup | Out-Null
        $appService = az webapp identity show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
        $principalId = $appService.principalId
        Write-Host "   Managed identity enabled. Principal ID: $principalId" -ForegroundColor Green
    }
}
catch {
    Write-Host "   Failed to get/enable managed identity: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Get AI Foundry Resource ID
Write-Host "`n2. Getting AI Foundry Resource ID..." -ForegroundColor Yellow
try {
    $foundry = az cognitiveservices account show --name $FoundryName --resource-group $ResourceGroup | ConvertFrom-Json
    $foundryResourceId = $foundry.id
    
    Write-Host "   Foundry Resource ID: $foundryResourceId" -ForegroundColor Green
}
catch {
    Write-Host "   Failed to get AI Foundry resource: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Check existing role assignments
Write-Host "`n3. Checking existing role assignments..." -ForegroundColor Yellow
$existingRoles = $null
try {
    $existingRoles = az role assignment list --assignee $principalId --scope $foundryResourceId | ConvertFrom-Json
    
    if ($existingRoles.Count -gt 0) {
        Write-Host "   Existing roles:" -ForegroundColor Cyan
        foreach ($role in $existingRoles) {
            Write-Host "      - $($role.roleDefinitionName)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "   No existing role assignments found" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "   Could not check existing roles (this is OK)" -ForegroundColor Yellow
}

# Step 4: Assign "Cognitive Services OpenAI User" role
Write-Host "`n4. Assigning 'Cognitive Services OpenAI User' role..." -ForegroundColor Yellow
$roleName = "Cognitive Services OpenAI User"

$hasRole = $false
if ($existingRoles) {
    $hasRole = $existingRoles | Where-Object { $_.roleDefinitionName -eq $roleName }
}

if ($hasRole) {
    Write-Host "   Role '$roleName' already assigned" -ForegroundColor Cyan
}
else {
    Write-Host "   Creating role assignment..." -ForegroundColor Yellow
    try {
        az role assignment create `
            --role $roleName `
            --assignee-object-id $principalId `
            --scope $foundryResourceId `
            --assignee-principal-type ServicePrincipal | Out-Null
        
        Write-Host "   Successfully assigned '$roleName' role" -ForegroundColor Green
    }
    catch {
        Write-Host "   Role assignment may have failed or already exists: $_" -ForegroundColor Yellow
        Write-Host "   If the role already exists, this error can be ignored" -ForegroundColor Cyan
    }
}

# Step 5: Verify the role assignment
Write-Host "`n5. Verifying role assignment..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $updatedRoles = az role assignment list --assignee $principalId --scope $foundryResourceId | ConvertFrom-Json
    $cognitiveServicesRole = $updatedRoles | Where-Object { $_.roleDefinitionName -eq $roleName }
    
    if ($cognitiveServicesRole) {
        Write-Host "   Role assignment verified!" -ForegroundColor Green
        Write-Host "   Role: $($cognitiveServicesRole.roleDefinitionName)" -ForegroundColor Gray
    }
    else {
        Write-Host "   Role not found in verification check" -ForegroundColor Yellow
        Write-Host "   This may be due to propagation delay. Wait a few minutes and try again." -ForegroundColor Cyan
    }
}
catch {
    Write-Host "   Could not verify role assignment: $_" -ForegroundColor Yellow
}

# Step 6: Restart App Service
Write-Host "`n6. Restarting App Service to apply permissions..." -ForegroundColor Yellow
try {
    az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
    Write-Host "   App Service restarted" -ForegroundColor Green
}
catch {
    Write-Host "   Failed to restart App Service: $_" -ForegroundColor Yellow
    Write-Host "   You may need to restart manually from Azure Portal" -ForegroundColor Cyan
}

Write-Host "`nRBAC Configuration Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Wait 2-3 minutes for Azure to propagate the role assignment" -ForegroundColor Gray
Write-Host "   2. Test the /api/recommendations endpoint through Swagger" -ForegroundColor Gray
Write-Host "   3. If still getting 401, check the Azure Portal -> AI Foundry -> Access Control (IAM)" -ForegroundColor Gray
Write-Host "`nReference: https://aka.ms/FoundryPermissions`n" -ForegroundColor Cyan
