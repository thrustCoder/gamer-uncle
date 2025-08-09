# Trigger Production Durable Function for BGG Game Sync
# This script manually triggers the durable function in production for testing/monitoring

param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function",
    [int]$SyncCount = 5
)

Write-Host "🚀 Triggering Production Durable Function" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check if we can access Azure CLI
Write-Host "`n1. Checking Azure CLI connection..." -ForegroundColor Yellow
try {
    $account = az account show | ConvertFrom-Json
    Write-Host "✅ Connected to Azure subscription: $($account.name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged into Azure CLI. Please run 'az login'" -ForegroundColor Red
    exit 1
}

# 2. Get Function App URL and access key
Write-Host "`n2. Getting Function App details..." -ForegroundColor Yellow
try {
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "✅ Function App found: $($functionApp.name)" -ForegroundColor Green
    Write-Host "   State: $($functionApp.state)" -ForegroundColor White
    
    if ($functionApp.state -ne "Running") {
        Write-Host "⚠️  Function App is not in running state: $($functionApp.state)" -ForegroundColor Yellow
    }
    
    $hostName = $functionApp.defaultHostName
    $functionUrl = "https://$hostName/api/GameSyncHttpStart"
    Write-Host "   Function URL: $functionUrl" -ForegroundColor White
    
} catch {
    Write-Host "❌ Function App not found or inaccessible" -ForegroundColor Red
    exit 1
}

# 3. Get Function access key
Write-Host "`n3. Getting Function access key..." -ForegroundColor Yellow
try {
    $masterKey = az functionapp keys list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
    $accessKey = $masterKey.functionKeys.default
    
    if ([string]::IsNullOrEmpty($accessKey)) {
        Write-Host "⚠️  No default function key found, trying master key..." -ForegroundColor Yellow
        $accessKey = $masterKey.masterKey
    }
    
    if ([string]::IsNullOrEmpty($accessKey)) {
        Write-Host "❌ Could not retrieve function access key" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Access key retrieved successfully" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to retrieve function access key" -ForegroundColor Red
    exit 1
}

# 4. Set the SyncGameCount environment variable (optional)
Write-Host "`n4. Setting SyncGameCount environment variable..." -ForegroundColor Yellow
try {
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "SyncGameCount=$SyncCount"
    Write-Host "✅ SyncGameCount set to $SyncCount" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to set SyncGameCount, continuing with existing value..." -ForegroundColor Yellow
}

# 5. Trigger the durable function
Write-Host "`n5. Triggering durable function..." -ForegroundColor Yellow
$fullUrl = "$functionUrl" + "?code=$accessKey"

try {
    Write-Host "   Sending POST request to: $functionUrl" -ForegroundColor White
    Write-Host "   Expected to sync $SyncCount games" -ForegroundColor White
    
    $response = Invoke-RestMethod -Uri $fullUrl -Method Post -ContentType "application/json" -Body "{}"
    
    Write-Host "✅ Function triggered successfully!" -ForegroundColor Green
    Write-Host "   Instance ID: $($response.instanceId)" -ForegroundColor Green
    
    # 6. Provide monitoring information
    Write-Host "`n6. Monitoring Information:" -ForegroundColor Yellow
    Write-Host "   🔍 Application Insights: Check logs for instance ID '$($response.instanceId)'" -ForegroundColor White
    Write-Host "   📊 Portal URL: https://portal.azure.com/#@/resource/subscriptions/$($account.id)/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$FunctionAppName/appInsights" -ForegroundColor White
    Write-Host "   ⏱️  Expected completion time: ~$($SyncCount * 2) seconds (approximate)" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "   💡 To check logs in Application Insights:" -ForegroundColor Blue
    Write-Host "      1. Go to Azure Portal > Function App > Application Insights" -ForegroundColor Blue
    Write-Host "      2. Search for traces with: customDimensions.prop__InstanceId == '$($response.instanceId)'" -ForegroundColor Blue
    Write-Host "      3. Or search for: customDimensions contains '$($response.instanceId)'" -ForegroundColor Blue
    
} catch {
    Write-Host "❌ Failed to trigger function" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    }
    
    Write-Host "" -ForegroundColor White
    Write-Host "💡 Troubleshooting:" -ForegroundColor Blue
    Write-Host "   - Check if the function app is running" -ForegroundColor Blue
    Write-Host "   - Verify the function key is valid" -ForegroundColor Blue
    Write-Host "   - Check Application Insights for errors" -ForegroundColor Blue
    exit 1
}

Write-Host "`n🎉 Script completed successfully!" -ForegroundColor Green
Write-Host "Monitor the Application Insights logs for detailed execution information." -ForegroundColor White
