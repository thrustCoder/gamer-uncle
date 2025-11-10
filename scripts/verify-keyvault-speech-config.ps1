#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verify Azure Speech Service Key Vault configuration for Dev and Prod environments

.DESCRIPTION
    This script verifies that:
    1. Key Vaults exist and are accessible
    2. Speech Service keys are stored in Key Vault
    3. App Services have proper RBAC permissions to read secrets
    4. App Service configuration references Key Vault correctly

.EXAMPLE
    .\verify-keyvault-speech-config.ps1
#>

param(
    [string]$SubscriptionId = "e1a26719-3504-42e4-bc8c-05aa63259e4b"
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Verifying Azure Speech Service Key Vault Configuration" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Set subscription context
Write-Host "📋 Setting subscription context..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId
Write-Host "✅ Subscription set: $SubscriptionId" -ForegroundColor Green
Write-Host ""

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

foreach ($env in $environments) {
    $envName = $env.Name
    $kvName = $env.KeyVault
    $rgName = $env.ResourceGroup
    $appSvcName = $env.AppService
    $speechSvcName = $env.SpeechService
    $expectedKvUri = $env.ExpectedKeyVaultUri
    
    Write-Host "🌍 Verifying $envName Environment" -ForegroundColor Magenta
    Write-Host "----------------------------------------" -ForegroundColor Magenta
    
    # Check 1: Key Vault exists
    Write-Host "  1️⃣  Checking Key Vault '$kvName' exists..." -NoNewline
    $kvExists = az keyvault show --name $kvName --resource-group $rgName --query "name" -o tsv 2>$null
    if ($kvExists) {
        Write-Host " ✅" -ForegroundColor Green
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 2: Speech Service key exists in Key Vault
    Write-Host "  2️⃣  Checking secret 'AzureSpeechKey' exists in Key Vault..." -NoNewline
    $secretExists = az keyvault secret show --vault-name $kvName --name "AzureSpeechKey" --query "name" -o tsv 2>$null
    if ($secretExists) {
        Write-Host " ✅" -ForegroundColor Green
        
        # Get secret metadata (not value)
        $secretMetadata = az keyvault secret show --vault-name $kvName --name "AzureSpeechKey" --query "{Enabled:attributes.enabled, Updated:attributes.updated}" -o json | ConvertFrom-Json
        Write-Host "     🔐 Secret enabled: $($secretMetadata.Enabled)" -ForegroundColor Gray
        Write-Host "     🕒 Last updated: $($secretMetadata.Updated)" -ForegroundColor Gray
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 3: App Service managed identity exists
    Write-Host "  3.  Checking App Service managed identity..." -NoNewline
    $identityId = az webapp identity show --name $appSvcName --resource-group $rgName --query "principalId" -o tsv 2>$null
    if ($identityId) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "     🆔 Identity ID: $identityId" -ForegroundColor Gray
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 4: App Service has RBAC role assignment to Key Vault
    if ($identityId) {
        Write-Host "  4️⃣  Checking RBAC permissions (Key Vault Secrets User)..." -NoNewline
        $kvScope = "/subscriptions/$SubscriptionId/resourceGroups/$rgName/providers/Microsoft.KeyVault/vaults/$kvName"
        $roleAssignment = az role assignment list --assignee $identityId --scope $kvScope --role "Key Vault Secrets User" --query "[0].roleDefinitionName" -o tsv 2>$null
        
        if ($roleAssignment -eq "Key Vault Secrets User") {
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host " ❌" -ForegroundColor Red
            Write-Host "     ⚠️  Role assignment missing or incorrect" -ForegroundColor Yellow
            $allChecksPass = $false
        }
    }
    
    # Check 5: App Service configuration references Key Vault
    Write-Host "  5️⃣  Checking App Service configuration..." -NoNewline
    $appSettings = az webapp config appsettings list --name $appSvcName --resource-group $rgName -o json | ConvertFrom-Json
    
    $kvUriSetting = $appSettings | Where-Object { $_.name -eq "AzureSpeech__KeyVaultUri" }
    $kvSecretSetting = $appSettings | Where-Object { $_.name -eq "AzureSpeech__KeySecretName" }
    $oldKeySetting = $appSettings | Where-Object { $_.name -eq "AzureSpeech__Key" }
    
    $configValid = $true
    
    if ($kvUriSetting -and $kvUriSetting.value -eq $expectedKvUri) {
        # Good - Key Vault URI is set
    } else {
        $configValid = $false
    }
    
    if ($kvSecretSetting -and $kvSecretSetting.value -eq "AzureSpeechKey") {
        # Good - Secret name is set
    } else {
        $configValid = $false
    }
    
    if ($oldKeySetting) {
        Write-Host " ⚠️" -ForegroundColor Yellow
        Write-Host "     ⚠️  Warning: Old AzureSpeech__Key setting still exists (hardcoded key)" -ForegroundColor Yellow
        $configValid = $false
    }
    
    if ($configValid) {
        Write-Host " ✅" -ForegroundColor Green
        Write-Host "     📝 KeyVaultUri: $($kvUriSetting.value)" -ForegroundColor Gray
        Write-Host "     📝 KeySecretName: $($kvSecretSetting.value)" -ForegroundColor Gray
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    # Check 6: Speech Service exists
    Write-Host "  6️⃣  Checking Azure Speech Service exists..." -NoNewline
    $speechServiceExists = az cognitiveservices account show --name $speechSvcName --resource-group $rgName --query "name" -o tsv 2>$null
    if ($speechServiceExists) {
        Write-Host " ✅" -ForegroundColor Green
        $speechServiceLocation = az cognitiveservices account show --name $speechSvcName --resource-group $rgName --query "location" -o tsv
        Write-Host "     📍 Location: $speechServiceLocation" -ForegroundColor Gray
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $allChecksPass = $false
    }
    
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Cyan
if ($allChecksPass) {
    Write-Host "✅ All checks passed! Key Vault integration is properly configured." -ForegroundColor Green
} else {
    Write-Host "❌ Some checks failed. Please review the errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Deploy the updated API code to Dev and Prod App Services" -ForegroundColor White
Write-Host "  2. Restart the App Services to pick up new configuration" -ForegroundColor White
Write-Host "  3. Test voice endpoint: POST /api/voice/process" -ForegroundColor White
Write-Host "  4. Monitor Application Insights for AzureSpeechService logs" -ForegroundColor White
Write-Host ""
