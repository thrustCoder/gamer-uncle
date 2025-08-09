# Production Durable Function Monitoring Script
# This script provides monitoring capabilities for the production BGG sync function

param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function",
    [switch]$TriggerSync,
    [int]$SyncCount = 1,
    [string]$CheckInstanceId
)

function Write-StatusMessage {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-FunctionAppDetails {
    Write-StatusMessage "`nGetting Function App details..." -Color Yellow
    
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    if (-not $functionApp) {
        Write-StatusMessage "❌ Function App not found" -Color Red
        return $null
    }
    
    Write-StatusMessage "✅ Function App: $($functionApp.name)" -Color Green
    Write-StatusMessage "   State: $($functionApp.state)" -Color White
    Write-StatusMessage "   Runtime Version: $($functionApp.functionsRuntimeVersion)" -Color White
    
    return $functionApp
}

function Test-ManagedIdentityConfig {
    Write-StatusMessage "`nChecking managed identity configuration..." -Color Yellow
    
    $identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    
    if ($identity.type -like "*SystemAssigned*") {
        Write-StatusMessage "✅ System-assigned managed identity is enabled" -Color Green
        Write-StatusMessage "   Principal ID: $($identity.principalId)" -Color White
        
        # Check RBAC assignments
        $roleAssignments = az cosmosdb sql role assignment list --account-name gamer-uncle-prod-cosmos --resource-group $ResourceGroup | ConvertFrom-Json
        $hasAccess = $roleAssignments | Where-Object { $_.principalId -eq $identity.principalId }
        
        if ($hasAccess) {
            Write-StatusMessage "✅ Cosmos DB RBAC assignment found" -Color Green
        } else {
            Write-StatusMessage "⚠️  No Cosmos DB RBAC assignment found" -Color Yellow
        }
        
        return $true
    } else {
        Write-StatusMessage "❌ No system-assigned managed identity" -Color Red
        return $false
    }
}

function Invoke-DurableFunctionSync {
    param($SyncCount)
    
    Write-StatusMessage "`nTriggering durable function sync..." -Color Yellow
    
    $functionApp = Get-FunctionAppDetails
    if (-not $functionApp) { return $null }
    
    # Get access key
    $masterKey = az functionapp keys list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    $accessKey = if ($masterKey.functionKeys.default) { $masterKey.functionKeys.default } else { $masterKey.masterKey }
    
    if (-not $accessKey) {
        Write-StatusMessage "❌ Could not retrieve access key" -Color Red
        return $null
    }
    
    # Set sync count
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "SyncGameCount=$SyncCount" | Out-Null
    
    # Trigger function
    $hostName = $functionApp.defaultHostName
    $functionUrl = "https://$hostName/api/GameSyncHttpStart?code=$accessKey"
    
    try {
        $response = Invoke-RestMethod -Uri $functionUrl -Method Post -ContentType "application/json" -Body "{}"
        Write-StatusMessage "✅ Function triggered successfully!" -Color Green
        Write-StatusMessage "   Instance ID: $($response.instanceId)" -Color Green
        Write-StatusMessage "   Expected to sync $SyncCount games" -Color White
        return $response.instanceId
    } catch {
        Write-StatusMessage "❌ Failed to trigger function: $($_.Exception.Message)" -Color Red
        return $null
    }
}

function Show-MonitoringInstructions {
    param($InstanceId)
    
    Write-StatusMessage "`n📊 Monitoring Instructions:" -Color Blue
    Write-StatusMessage "==============================" -Color Blue
    Write-StatusMessage "1. Check Azure Portal Application Insights:" -Color White
    Write-StatusMessage "   - Go to Azure Portal > Function App > Application Insights" -Color Gray
    Write-StatusMessage "   - Search for: customDimensions contains '$InstanceId'" -Color Gray
    Write-StatusMessage "" -Color White
    Write-StatusMessage "2. Check for successful completion:" -Color White
    Write-StatusMessage "   - Look for 'Successfully upserted game document' messages" -Color Gray
    Write-StatusMessage "   - Check for any error messages with the instance ID" -Color Gray
    Write-StatusMessage "" -Color White
    Write-StatusMessage "3. Expected timeline:" -Color White
    Write-StatusMessage "   - Single game: ~2-5 seconds" -Color Gray
    Write-StatusMessage "   - 5 games: ~10-15 seconds" -Color Gray
}

# Main execution
Write-StatusMessage "🔍 Production Durable Function Monitor" -Color Cyan
Write-StatusMessage "=====================================" -Color Cyan

# Test configuration
$identityOk = Test-ManagedIdentityConfig
$functionApp = Get-FunctionAppDetails

if (-not $identityOk -or -not $functionApp) {
    Write-StatusMessage "`n❌ Configuration issues detected. Please fix before proceeding." -Color Red
    exit 1
}

# Execute requested action
if ($TriggerSync) {
    $instanceId = Invoke-DurableFunctionSync -SyncCount $SyncCount
    if ($instanceId) {
        Show-MonitoringInstructions -InstanceId $instanceId
    }
} elseif ($CheckInstanceId) {
    Write-StatusMessage "`nInstance ID: $CheckInstanceId" -Color White
    Show-MonitoringInstructions -InstanceId $CheckInstanceId
} else {
    Write-StatusMessage "`n✅ Configuration check completed successfully!" -Color Green
    Write-StatusMessage "`nUsage examples:" -Color Blue
    Write-StatusMessage "  Monitor-DurableFunction.ps1 -TriggerSync -SyncCount 1" -Color Gray
    Write-StatusMessage "  Monitor-DurableFunction.ps1 -CheckInstanceId 'your-instance-id'" -Color Gray
}

Write-StatusMessage "`n🎉 Monitoring script completed!" -Color Green
