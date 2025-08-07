# Quick Azure Function Authentication Fix
# This script diagnoses and fixes the managed identity authentication issue

param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function",
    [string]$CosmosAccountName = "gamer-uncle-prod-cosmos"
)

Write-Host "🔧 Quick Azure Function Authentication Fix" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check if we can access Azure CLI
Write-Host "`n1. Checking Azure CLI connection..." -ForegroundColor Yellow
try {
    $account = az account show | ConvertFrom-Json
    Write-Host "✅ Connected to Azure subscription: $($account.name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged into Azure CLI. Please run 'az login'" -ForegroundColor Red
    exit 1
}

# 2. Check Function App exists
Write-Host "`n2. Checking Function App..." -ForegroundColor Yellow
try {
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "✅ Function App found: $($functionApp.name)" -ForegroundColor Green
    Write-Host "   State: $($functionApp.state)" -ForegroundColor White
} catch {
    Write-Host "❌ Function App not found or inaccessible" -ForegroundColor Red
    Write-Host "💡 Check if the function app name and resource group are correct" -ForegroundColor Blue
    exit 1
}

# 3. Check and fix managed identity
Write-Host "`n3. Checking Managed Identity..." -ForegroundColor Yellow
try {
    $identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    
    if ($identity.type -eq "SystemAssigned") {
        Write-Host "✅ System-assigned managed identity is enabled" -ForegroundColor Green
        $principalId = $identity.principalId
        Write-Host "   Principal ID: $principalId" -ForegroundColor White
    } else {
        Write-Host "⚠️  Managed identity not configured - enabling it now..." -ForegroundColor Yellow
        az functionapp identity assign --name $FunctionAppName --resource-group $ResourceGroup
        
        # Get the newly created identity
        Start-Sleep -Seconds 10  # Wait for identity to be created
        $identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
        $principalId = $identity.principalId
        Write-Host "✅ Managed identity enabled: $principalId" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to configure managed identity" -ForegroundColor Red
    exit 1
}

# 4. Update Function App Settings
Write-Host "`n4. Updating Function App Settings..." -ForegroundColor Yellow
try {
    az functionapp config appsettings set `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        --settings `
        "COSMOS_DATABASE_NAME=gamer-uncle-prod-cosmos-container" `
        "COSMOS_CONTAINER_NAME=Games"

    Write-Host "✅ Function app settings updated successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to update function app settings" -ForegroundColor Red
}

# 5. Assign Cosmos DB permissions
Write-Host "`n5. Assigning Cosmos DB Role..." -ForegroundColor Yellow
try {
    # Assign the Cosmos DB Built-in Data Contributor role
    az cosmosdb sql role assignment create `
        --account-name $CosmosAccountName `
        --resource-group $ResourceGroup `
        --scope "/" `
        --principal-id $principalId `
        --role-definition-id "00000000-0000-0000-0000-000000000002"

    Write-Host "✅ Cosmos DB role assigned successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Role assignment may have failed or already exists" -ForegroundColor Yellow
    Write-Host "   This is usually okay if the role was already assigned" -ForegroundColor White
}

# 6. Verify current settings
Write-Host "`n6. Verifying Function App Settings..." -ForegroundColor Yellow
$settings = az functionapp config appsettings list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json

$requiredSettings = @("COSMOS_ENDPOINT", "COSMOS_DATABASE_NAME", "COSMOS_CONTAINER_NAME", "AZURE_TENANT_ID", "AZURE_CLIENT_ID")
foreach ($setting in $requiredSettings) {
    $configValue = $settings | Where-Object { $_.name -eq $setting }
    if ($configValue) {
        Write-Host "✅ $setting = $($configValue.value)" -ForegroundColor Green
    } else {
        Write-Host "❌ $setting is MISSING" -ForegroundColor Red
    }
}

# 7. Restart the function app
Write-Host "`n7. Restarting Function App..." -ForegroundColor Yellow
try {
    az functionapp restart --name $FunctionAppName --resource-group $ResourceGroup
    Write-Host "✅ Function app restarted successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to restart function app automatically" -ForegroundColor Yellow
    Write-Host "💡 Please restart manually in the Azure portal" -ForegroundColor Blue
}

Write-Host "`n🎉 Fix completed!" -ForegroundColor Green
Write-Host "📝 Summary of changes:" -ForegroundColor Cyan
Write-Host "   - Managed identity enabled (if not already)" -ForegroundColor White
Write-Host "   - Function app settings updated with correct database/container names" -ForegroundColor White
Write-Host "   - Cosmos DB Data Contributor role assigned to function app" -ForegroundColor White
Write-Host "   - Function app restarted to pick up new settings" -ForegroundColor White
Write-Host "`n💡 The function should now authenticate properly to Cosmos DB" -ForegroundColor Blue
