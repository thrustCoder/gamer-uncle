# Simple Production Function Test Script
param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function",
    [int]$SyncCount = 1
)

Write-Host "Testing Production Durable Function" -ForegroundColor Cyan

# Check managed identity
Write-Host "`n1. Checking managed identity..." -ForegroundColor Yellow
$identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json

if ($identity.type -like "*SystemAssigned*") {
    Write-Host "   System-assigned managed identity: ENABLED" -ForegroundColor Green
} else {
    Write-Host "   System-assigned managed identity: MISSING" -ForegroundColor Red
    exit 1
}

# Check function app
Write-Host "`n2. Getting function app details..." -ForegroundColor Yellow
$functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
Write-Host "   State: $($functionApp.state)" -ForegroundColor White

# Get access key
Write-Host "`n3. Getting access key..." -ForegroundColor Yellow
$masterKey = az functionapp keys list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
$accessKey = $masterKey.functionKeys.default
if ([string]::IsNullOrEmpty($accessKey)) {
    $accessKey = $masterKey.masterKey
}

# Set sync count
Write-Host "`n4. Setting sync count to $SyncCount..." -ForegroundColor Yellow
az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "SyncGameCount=$SyncCount" | Out-Null

# Trigger function
Write-Host "`n5. Triggering function..." -ForegroundColor Yellow
$hostName = $functionApp.defaultHostName
$functionUrl = "https://$hostName/api/GameSyncHttpStart?code=$accessKey"

try {
    $response = Invoke-RestMethod -Uri $functionUrl -Method Post -ContentType "application/json" -Body "{}"
    Write-Host "   SUCCESS! Instance ID: $($response.instanceId)" -ForegroundColor Green
    
    Write-Host "`n6. Monitoring:" -ForegroundColor Blue
    Write-Host "   Check Azure Portal Application Insights for instance: $($response.instanceId)" -ForegroundColor White
    Write-Host "   Expected completion time: ~$($SyncCount * 2) seconds" -ForegroundColor White
    
} catch {
    Write-Host "   FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Green
