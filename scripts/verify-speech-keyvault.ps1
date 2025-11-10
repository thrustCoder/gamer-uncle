#!/usr/bin/env pwsh
# Verify Azure Speech Service Key Vault configuration for Dev and Prod environments

param(
    [string]$SubscriptionId = "e1a26719-3504-42e4-bc8c-05aa63259e4b"
)

$ErrorActionPreference = "Stop"

Write-Host "`nVerifying Azure Speech Service Key Vault Configuration" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# Set subscription context
az account set --subscription $SubscriptionId
Write-Host "Subscription set: $SubscriptionId`n" -ForegroundColor Green

# Define environments
$environments = @(
    @{
        Name = "Dev"
        KeyVault = "gamer-uncle-dev-vault"
        ResourceGroup = "gamer-uncle-dev-rg"
        AppService = "gamer-uncle-dev-app-svc"
        SpeechService = "gamer-uncle-dev-speech"
        ExpectedKeyVaultUri = "https://gamer-uncle-dev-vault.vault.azure.net/"
    },
    @{
        Name = "Prod"
        KeyVault = "gamer-uncle-prod-vault"
        ResourceGroup = "gamer-uncle-prod-rg"
        AppService = "gamer-uncle-prod-app-svc"
        SpeechService = "gamer-uncle-prod-speech"
        ExpectedKeyVaultUri = "https://gamer-uncle-prod-vault.vault.azure.net/"
    }
)

$allChecksPass = $true

foreach ($config in $environments) {
    $envName = $config.Name
    $kvName = $config.KeyVault
    $rgName = $config.ResourceGroup
    $appSvcName = $config.AppService
    $speechSvcName = $config.SpeechService
    $expectedKvUri = $config.ExpectedKeyVaultUri
    
    Write-Host "Verifying $envName Environment" -ForegroundColor Magenta
    Write-Host "----------------------------------------" -ForegroundColor Magenta
    
    # Check 1: Key Vault exists
    Write-Host "  [1] Checking Key Vault exists..." -NoNewline
    $kvExists = az keyvault show --name $kvName --resource-group $rgName --query "name" -o tsv 2>$null
    if ($kvExists) {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 2: Speech Service key exists in Key Vault
    Write-Host "  [2] Checking secret exists in Key Vault..." -NoNewline
    $secretExists = az keyvault secret show --vault-name $kvName --name "AzureSpeechKey" --query "name" -o tsv 2>$null
    if ($secretExists) {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 3: App Service managed identity exists
    Write-Host "  [3] Checking App Service managed identity..." -NoNewline
    $identityId = az webapp identity show --name $appSvcName --resource-group $rgName --query "principalId" -o tsv 2>$null
    if ($identityId) {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 4: App Service has RBAC role assignment to Key Vault
    if ($identityId) {
        Write-Host "  [4] Checking RBAC permissions..." -NoNewline
        $kvScope = "/subscriptions/$SubscriptionId/resourceGroups/$rgName/providers/Microsoft.KeyVault/vaults/$kvName"
        $roleAssignment = az role assignment list --assignee $identityId --scope $kvScope --role "Key Vault Secrets User" --query "[0].roleDefinitionName" -o tsv 2>$null
        
        if ($roleAssignment -eq "Key Vault Secrets User") {
            Write-Host " PASS" -ForegroundColor Green
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            $allChecksPass = $false
        }
    }
    
    # Check 5: App Service configuration references Key Vault
    Write-Host "  [5] Checking App Service configuration..." -NoNewline
    $appSettings = az webapp config appsettings list --name $appSvcName --resource-group $rgName -o json | ConvertFrom-Json
    
    $kvUriSetting = $appSettings | Where-Object { $_.name -eq "AzureSpeech__KeyVaultUri" }
    $kvSecretSetting = $appSettings | Where-Object { $_.name -eq "AzureSpeech__KeySecretName" }
    $oldKeySetting = $appSettings | Where-Object { $_.name -eq "AzureSpeech__Key" }
    
    $configValid = $true
    
    if (-not $kvUriSetting -or $kvUriSetting.value -ne $expectedKvUri) {
        $configValid = $false
    }
    
    if (-not $kvSecretSetting -or $kvSecretSetting.value -ne "AzureSpeechKey") {
        $configValid = $false
    }
    
    if ($oldKeySetting) {
        $configValid = $false
        Write-Host " WARN (hardcoded key exists)" -ForegroundColor Yellow
    } elseif ($configValid) {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 6: Speech Service exists
    Write-Host "  [6] Checking Azure Speech Service exists..." -NoNewline
    $speechServiceExists = az cognitiveservices account show --name $speechSvcName --resource-group $rgName --query "name" -o tsv 2>$null
    if ($speechServiceExists) {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    Write-Host ""
}

Write-Host "========================================================" -ForegroundColor Cyan
if ($allChecksPass) {
    Write-Host "SUCCESS: All checks passed!" -ForegroundColor Green
} else {
    Write-Host "FAILED: Some checks failed. Review errors above." -ForegroundColor Red
    exit 1
}

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Deploy the updated API code to Dev and Prod" -ForegroundColor White
Write-Host "  2. Restart the App Services" -ForegroundColor White
Write-Host "  3. Test voice endpoint: POST /api/voice/process" -ForegroundColor White
Write-Host "  4. Monitor Application Insights for logs`n" -ForegroundColor White
