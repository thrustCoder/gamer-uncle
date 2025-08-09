# Diagnose Azure Function Managed Identity and Configuration Issues
# This script checks the managed identity configuration and required environment variables

param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function"
)

Write-Host "🔍 Diagnosing Function App Identity Configuration" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Check if we can access Azure CLI
Write-Host "`n1. Checking Azure CLI connection..." -ForegroundColor Yellow
try {
    $account = az account show | ConvertFrom-Json
    Write-Host "✅ Connected to Azure subscription: $($account.name)" -ForegroundColor Green
    Write-Host "   Account ID: $($account.id)" -ForegroundColor White
} catch {
    Write-Host "❌ Not logged into Azure CLI. Please run 'az login'" -ForegroundColor Red
    exit 1
}

# 2. Check Function App existence and state
Write-Host "`n2. Checking Function App status..." -ForegroundColor Yellow
try {
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "✅ Function App found: $($functionApp.name)" -ForegroundColor Green
    Write-Host "   State: $($functionApp.state)" -ForegroundColor White
    Write-Host "   Kind: $($functionApp.kind)" -ForegroundColor White
    Write-Host "   Default Hostname: $($functionApp.defaultHostName)" -ForegroundColor White
} catch {
    Write-Host "❌ Function App not found or inaccessible" -ForegroundColor Red
    exit 1
}

# 3. Check Managed Identity configuration
Write-Host "`n3. Checking Managed Identity configuration..." -ForegroundColor Yellow
try {
    $identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    
    if ($identity.type -eq "SystemAssigned") {
        Write-Host "✅ System-assigned managed identity is enabled" -ForegroundColor Green
        Write-Host "   Principal ID: $($identity.principalId)" -ForegroundColor White
        Write-Host "   Tenant ID: $($identity.tenantId)" -ForegroundColor White
    } elseif ($identity.type -eq "UserAssigned") {
        Write-Host "✅ User-assigned managed identity is enabled" -ForegroundColor Green
        Write-Host "   User Assigned Identities:" -ForegroundColor White
        $identity.userAssignedIdentities.PSObject.Properties | ForEach-Object {
            Write-Host "     - $($_.Name)" -ForegroundColor White
            Write-Host "       Principal ID: $($_.Value.principalId)" -ForegroundColor White
            Write-Host "       Client ID: $($_.Value.clientId)" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  No managed identity configured" -ForegroundColor Yellow
        Write-Host "   Type: $($identity.type)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Failed to check managed identity configuration" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Check Environment Variables
Write-Host "`n4. Checking required environment variables..." -ForegroundColor Yellow
try {
    $appSettings = az functionapp config appsettings list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    
    $requiredSettings = @(
        "COSMOS_ENDPOINT",
        "COSMOS_DATABASE_NAME", 
        "COSMOS_CONTAINER_NAME",
        "AZURE_TENANT_ID",
        "AZURE_CLIENT_ID",
        "APPLICATIONINSIGHTS_CONNECTION_STRING"
    )
    
    Write-Host "   Required settings status:" -ForegroundColor White
    foreach ($setting in $requiredSettings) {
        $found = $appSettings | Where-Object { $_.name -eq $setting }
        if ($found) {
            if ($setting -like "*CONNECTION_STRING*" -or $setting -like "*ENDPOINT*") {
                # Show partial value for sensitive settings
                $maskedValue = if ($found.value.Length -gt 20) { 
                    $found.value.Substring(0, 20) + "..." 
                } else { 
                    $found.value 
                }
                Write-Host "     ✅ $setting = $maskedValue" -ForegroundColor Green
            } else {
                Write-Host "     ✅ $setting = $($found.value)" -ForegroundColor Green
            }
        } else {
            Write-Host "     ❌ $setting = NOT SET" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Failed to retrieve app settings" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Check Cosmos DB Resource and RBAC assignments
Write-Host "`n5. Checking Cosmos DB configuration..." -ForegroundColor Yellow
try {
    # Get Cosmos endpoint from app settings
    $cosmosEndpointSetting = $appSettings | Where-Object { $_.name -eq "COSMOS_ENDPOINT" }
    if ($cosmosEndpointSetting) {
        $cosmosEndpoint = $cosmosEndpointSetting.value
        
        # Extract account name from endpoint
        if ($cosmosEndpoint -like "https://*.documents.azure.com*") {
            $startIndex = $cosmosEndpoint.IndexOf("https://") + 8
            $endIndex = $cosmosEndpoint.IndexOf(".documents.azure.com")
            $cosmosAccountName = $cosmosEndpoint.Substring($startIndex, $endIndex - $startIndex)
            Write-Host "   Cosmos Account Name: $cosmosAccountName" -ForegroundColor White
            
            # Try to find the Cosmos account
            $cosmosAccounts = az cosmosdb list | ConvertFrom-Json
            $cosmosAccount = $cosmosAccounts | Where-Object { $_.name -eq $cosmosAccountName }
            
            if ($cosmosAccount) {
                Write-Host "   ✅ Cosmos DB account found: $($cosmosAccount.name)" -ForegroundColor Green
                Write-Host "     Resource Group: $($cosmosAccount.resourceGroup)" -ForegroundColor White
                Write-Host "     Location: $($cosmosAccount.location)" -ForegroundColor White
                
                # Check RBAC assignments for the function's managed identity
                Write-Host "`n6. Checking RBAC assignments..." -ForegroundColor Yellow
                if ($identity.principalId) {
                    $roleAssignments = az role assignment list --assignee $identity.principalId --scope $cosmosAccount.id | ConvertFrom-Json
                    
                    if ($roleAssignments.Count -gt 0) {
                        Write-Host "   ✅ Found RBAC assignments:" -ForegroundColor Green
                        foreach ($assignment in $roleAssignments) {
                            Write-Host "     - Role: $($assignment.roleDefinitionName)" -ForegroundColor White
                            Write-Host "       Scope: $($assignment.scope)" -ForegroundColor White
                        }
                    } else {
                        Write-Host "   ❌ No RBAC assignments found for the managed identity" -ForegroundColor Red
                        Write-Host "     This is likely the cause of the authentication failure!" -ForegroundColor Red
                        Write-Host "     Suggestion: Assign 'Cosmos DB Built-in Data Contributor' role" -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "   ⚠️  Cosmos DB account '$cosmosAccountName' not found in current subscription" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ⚠️  Could not parse Cosmos endpoint: $cosmosEndpoint" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ COSMOS_ENDPOINT not configured" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to check Cosmos DB configuration" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔧 Troubleshooting Recommendations:" -ForegroundColor Blue
Write-Host "=================================" -ForegroundColor Blue
Write-Host "1. If RBAC assignments are missing:" -ForegroundColor Blue
Write-Host "   az cosmosdb sql role assignment create \\" -ForegroundColor Gray
Write-Host "     --account-name <cosmos-account-name> \\" -ForegroundColor Gray
Write-Host "     --resource-group <cosmos-resource-group> \\" -ForegroundColor Gray
Write-Host "     --scope '/' \\" -ForegroundColor Gray
Write-Host "     --principal-id $($identity.principalId) \\" -ForegroundColor Gray
Write-Host "     --role-definition-name 'Cosmos DB Built-in Data Contributor'" -ForegroundColor Gray

Write-Host "`n2. If managed identity is missing:" -ForegroundColor Blue
Write-Host "   az functionapp identity assign --name $FunctionAppName --resource-group $ResourceGroup" -ForegroundColor Gray

Write-Host "`n3. Check Application Insights for detailed error logs" -ForegroundColor Blue
Write-Host "`n4. Verify all environment variables are correctly set" -ForegroundColor Blue

Write-Host "`n✅ Diagnostic completed!" -ForegroundColor Green
