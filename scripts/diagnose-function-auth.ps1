# Azure Function Authentication Diagnostic Script
# This script helps diagnose managed identity authentication issues

param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function",
    [string]$CosmosAccountName = "gamer-uncle-prod-cosmos"
)

Write-Host "🔍 Azure Function Authentication Diagnostics" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Check if function app exists and is running
Write-Host "`n1. Checking Function App Status..." -ForegroundColor Yellow
try {
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "✅ Function App exists: $($functionApp.name)" -ForegroundColor Green
    Write-Host "   State: $($functionApp.state)" -ForegroundColor White
    Write-Host "   Runtime: $($functionApp.linuxFxVersion)" -ForegroundColor White
} catch {
    Write-Host "❌ Function App not found or inaccessible" -ForegroundColor Red
    exit 1
}

# 2. Check managed identity configuration
Write-Host "`n2. Checking Managed Identity..." -ForegroundColor Yellow
try {
    $identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    if ($identity.type -eq "SystemAssigned") {
        Write-Host "✅ System-assigned managed identity is enabled" -ForegroundColor Green
        Write-Host "   Principal ID: $($identity.principalId)" -ForegroundColor White
        Write-Host "   Tenant ID: $($identity.tenantId)" -ForegroundColor White
        $principalId = $identity.principalId
    } elseif ($identity.type -eq "UserAssigned") {
        Write-Host "✅ User-assigned managed identity is enabled" -ForegroundColor Green
        $userAssignedIdentities = $identity.userAssignedIdentities
        $firstIdentity = $userAssignedIdentities.PSObject.Properties | Select-Object -First 1
        $identityDetails = $firstIdentity.Value
        Write-Host "   Principal ID: $($identityDetails.principalId)" -ForegroundColor White
        Write-Host "   Client ID: $($identityDetails.clientId)" -ForegroundColor White
        $principalId = $identityDetails.principalId
    } else {
        Write-Host "❌ No managed identity is enabled" -ForegroundColor Red
        Write-Host "💡 Fix: Enable managed identity on the Function App" -ForegroundColor Blue
        exit 1
    }
} catch {
    Write-Host "❌ Failed to check managed identity" -ForegroundColor Red
    exit 1
}

# 3. Check function app settings
Write-Host "`n3. Checking Function App Settings..." -ForegroundColor Yellow
try {
    $settings = az functionapp config appsettings list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    $requiredSettings = @("COSMOS_ENDPOINT", "AZURE_TENANT_ID", "AZURE_CLIENT_ID", "COSMOS_DATABASE_NAME", "COSMOS_CONTAINER_NAME")
    
    foreach ($setting in $requiredSettings) {
        $configValue = $settings | Where-Object { $_.name -eq $setting }
        if ($configValue) {
            Write-Host "✅ $setting is configured" -ForegroundColor Green
            if ($setting -eq "COSMOS_ENDPOINT") {
                Write-Host "   Value: $($configValue.value)" -ForegroundColor White
            }
        } else {
            Write-Host "❌ $setting is MISSING" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Failed to check function app settings" -ForegroundColor Red
}

# 4. Check Cosmos DB account
Write-Host "`n4. Checking Cosmos DB Account..." -ForegroundColor Yellow
try {
    $cosmosAccount = az cosmosdb show --name $CosmosAccountName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "✅ Cosmos DB account exists: $($cosmosAccount.name)" -ForegroundColor Green
    Write-Host "   Endpoint: $($cosmosAccount.documentEndpoint)" -ForegroundColor White
    Write-Host "   Location: $($cosmosAccount.location)" -ForegroundColor White
} catch {
    Write-Host "❌ Cosmos DB account not found or inaccessible" -ForegroundColor Red
    Write-Host "💡 Check if the Cosmos DB account name is correct" -ForegroundColor Blue
}

# 5. Check RBAC role assignments for the function app
Write-Host "`n5. Checking Cosmos DB Role Assignments..." -ForegroundColor Yellow
try {
    $cosmosResourceId = "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.DocumentDB/databaseAccounts/$CosmosAccountName"
    
    # Check for Cosmos DB built-in roles
    $roleAssignments = az role assignment list --assignee $principalId --scope $cosmosResourceId | ConvertFrom-Json
    
    if ($roleAssignments.Count -gt 0) {
        Write-Host "✅ Found role assignments:" -ForegroundColor Green
        foreach ($assignment in $roleAssignments) {
            Write-Host "   Role: $($assignment.roleDefinitionName)" -ForegroundColor White
            Write-Host "   Scope: $($assignment.scope)" -ForegroundColor White
        }
    } else {
        Write-Host "❌ No RBAC role assignments found for the function app on Cosmos DB" -ForegroundColor Red
        Write-Host "💡 The function app needs 'Cosmos DB Built-in Data Contributor' role" -ForegroundColor Blue
    }
} catch {
    Write-Host "⚠️  Could not check role assignments (may require elevated permissions)" -ForegroundColor Yellow
}

# 6. Check Cosmos DB containers
Write-Host "`n6. Checking Cosmos DB Containers..." -ForegroundColor Yellow
try {
    # Try production database first, then fallback to dev if needed
    $databaseName = "gamer-uncle-prod-cosmos-container"
    if ($FunctionAppName -like "*dev*") {
        $databaseName = "gamer-uncle-dev-cosmos-container"
    }
    
    Write-Host "   Checking database: $databaseName" -ForegroundColor White
    $containers = az cosmosdb sql container list --account-name $CosmosAccountName --database-name $databaseName --resource-group $ResourceGroup | ConvertFrom-Json
    
    $gamesContainer = $containers | Where-Object { $_.name -eq "Games" }
    if ($gamesContainer) {
        Write-Host "✅ 'Games' container exists in database '$databaseName'" -ForegroundColor Green
    } else {
        Write-Host "❌ 'Games' container NOT found in database '$databaseName'" -ForegroundColor Red
        Write-Host "💡 Available containers:" -ForegroundColor Blue
        foreach ($container in $containers) {
            Write-Host "   - $($container.name)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "⚠️  Could not check containers (database might not exist)" -ForegroundColor Yellow
}

# 7. Recommendations
Write-Host "`n🔧 Recommended Actions:" -ForegroundColor Cyan
Write-Host "1. Ensure managed identity is enabled on the Function App" -ForegroundColor White
Write-Host "2. Grant 'Cosmos DB Built-in Data Contributor' role to the function app:" -ForegroundColor White
Write-Host "   az cosmosdb sql role assignment create --account-name $CosmosAccountName --resource-group $ResourceGroup --scope '/' --principal-id $principalId --role-definition-id '00000000-0000-0000-0000-000000000002'" -ForegroundColor Gray
Write-Host "3. Verify environment variables are correctly set" -ForegroundColor White
Write-Host "4. Check if container and database names match the code" -ForegroundColor White

Write-Host "`n📋 Function Code Review:" -ForegroundColor Cyan
Write-Host "- Database name in code: 'gamer-uncle-dev-cosmos-container'" -ForegroundColor White
Write-Host "- Container name in code: 'Games'" -ForegroundColor White
Write-Host "- Make sure these match your actual Cosmos DB structure" -ForegroundColor White

Write-Host "`nDiagnostic completed!" -ForegroundColor Green
