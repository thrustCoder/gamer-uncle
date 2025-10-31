#!/usr/bin/env pwsh
# Fix RBAC permissions for Dev API App Service to access Azure AI Foundry Agent Service at PROJECT level

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Fix Dev API Foundry RBAC - Project Level" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Configuration
$ResourceGroup = "gamer-uncle-dev-rg"
$AppServiceName = "gamer-uncle-dev-app-svc"
$FoundryName = "gamer-uncle-dev-foundry"
$ProjectName = "gamer-uncle-dev-foundry-project"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "   Resource Group: $ResourceGroup"
Write-Host "   App Service: $AppServiceName"
Write-Host "   AI Foundry: $FoundryName"
Write-Host "   Project: $ProjectName`n"

# Step 1: Get App Service Managed Identity Principal ID
Write-Host "1. Getting App Service Managed Identity..." -ForegroundColor Yellow
try {
    $appService = az webapp identity show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
    $principalId = $appService.principalId
    Write-Host "   Principal ID: $principalId" -ForegroundColor Green
}
catch {
    Write-Host "   Failed to get managed identity: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Get AI Foundry Project Resource ID
Write-Host "`n2. Getting AI Foundry Project Resource ID..." -ForegroundColor Yellow
try {
    $projectResourceId = "/subscriptions/e1a26719-3504-42e4-bc8c-05aa63259e4b/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$FoundryName/projects/$ProjectName"
    Write-Host "   Project Resource ID: $projectResourceId" -ForegroundColor Green
}
catch {
    Write-Host "   Failed to construct project resource ID: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Check existing role assignments at project level
Write-Host "`n3. Checking existing role assignments at project level..." -ForegroundColor Yellow
try {
    $existingRoles = az role assignment list --assignee $principalId --scope $projectResourceId | ConvertFrom-Json
    
    if ($existingRoles.Count -gt 0) {
        Write-Host "   Existing roles at project level:" -ForegroundColor Cyan
        foreach ($role in $existingRoles) {
            Write-Host "      - $($role.roleDefinitionName)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "   No existing role assignments found at project level" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "   Could not check existing roles (this is OK)" -ForegroundColor Yellow
}

# Step 4: Assign "Cognitive Services OpenAI User" role at PROJECT level
Write-Host "`n4. Assigning 'Cognitive Services OpenAI User' role at PROJECT level..." -ForegroundColor Yellow
$roleName = "Cognitive Services OpenAI User"

$hasRole = $false
if ($existingRoles) {
    $hasRole = $existingRoles | Where-Object { $_.roleDefinitionName -eq $roleName }
}

if ($hasRole) {
    Write-Host "   Role '$roleName' already assigned at project level" -ForegroundColor Cyan
}
else {
    Write-Host "   Creating role assignment at project level..." -ForegroundColor Yellow
    try {
        az role assignment create `
            --role $roleName `
            --assignee-object-id $principalId `
            --scope $projectResourceId `
            --assignee-principal-type ServicePrincipal | Out-Null
        
        Write-Host "   Successfully assigned '$roleName' role at project level" -ForegroundColor Green
    }
    catch {
        Write-Host "   Role assignment may have failed or already exists: $_" -ForegroundColor Yellow
    }
}

# Step 5: Also assign "Azure AI Developer" role at PROJECT level
Write-Host "`n5. Assigning 'Azure AI Developer' role at PROJECT level..." -ForegroundColor Yellow
$aiDevRole = "Azure AI Developer"

$hasAiDevRole = $false
if ($existingRoles) {
    $hasAiDevRole = $existingRoles | Where-Object { $_.roleDefinitionName -eq $aiDevRole }
}

if ($hasAiDevRole) {
    Write-Host "   Role '$aiDevRole' already assigned at project level" -ForegroundColor Cyan
}
else {
    Write-Host "   Creating role assignment at project level..." -ForegroundColor Yellow
    try {
        az role assignment create `
            --role $aiDevRole `
            --assignee-object-id $principalId `
            --scope $projectResourceId `
            --assignee-principal-type ServicePrincipal | Out-Null
        
        Write-Host "   Successfully assigned '$aiDevRole' role at project level" -ForegroundColor Green
    }
    catch {
        Write-Host "   Role assignment may have failed or already exists: $_" -ForegroundColor Yellow
    }
}

# Step 6: Verify the role assignments
Write-Host "`n6. Verifying role assignments at project level..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $updatedRoles = az role assignment list --assignee $principalId --scope $projectResourceId | ConvertFrom-Json
    
    Write-Host "   Roles assigned at project level:" -ForegroundColor Cyan
    foreach ($role in $updatedRoles) {
        Write-Host "      - $($role.roleDefinitionName)" -ForegroundColor Green
    }
}
catch {
    Write-Host "   Could not verify role assignment: $_" -ForegroundColor Yellow
}

# Step 7: Restart App Service
Write-Host "`n7. Restarting App Service to apply permissions..." -ForegroundColor Yellow
try {
    az webapp restart --name $AppServiceName --resource-group $ResourceGroup | Out-Null
    Write-Host "   App Service restarted" -ForegroundColor Green
}
catch {
    Write-Host "   Failed to restart App Service: $_" -ForegroundColor Yellow
}

Write-Host "`nRBAC Configuration at PROJECT Level Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Wait 2-3 minutes for Azure to propagate the role assignment" -ForegroundColor Gray
Write-Host "   2. Test the /api/recommendations endpoint through Swagger" -ForegroundColor Gray
Write-Host "   3. The 401 error should now be resolved" -ForegroundColor Gray
Write-Host "`nReference: https://aka.ms/FoundryPermissions`n" -ForegroundColor Cyan
