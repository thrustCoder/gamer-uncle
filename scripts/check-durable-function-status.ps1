# Check Durable Function Status
param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function",
    [string]$InstanceId = "5d39bf5aa03e40c0b14cda1151106971"
)

Write-Host "Checking Durable Function Status" -ForegroundColor Cyan
Write-Host "Instance ID: $InstanceId" -ForegroundColor White

# Get Function App URL and access key
Write-Host "`nGetting Function App details..." -ForegroundColor Yellow
$functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
$hostName = $functionApp.defaultHostName

# Get access key
$masterKey = az functionapp keys list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json
$accessKey = $masterKey.functionKeys.default
if ([string]::IsNullOrEmpty($accessKey)) {
    $accessKey = $masterKey.masterKey
}

# Check status
$statusUrl = "https://$hostName/runtime/webhooks/durabletask/instances/$InstanceId" + "?code=$accessKey"

Write-Host "`nChecking orchestration status..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri $statusUrl -Method Get
    
    Write-Host "Status: $($response.runtimeStatus)" -ForegroundColor $(if ($response.runtimeStatus -eq "Completed") { "Green" } elseif ($response.runtimeStatus -eq "Failed") { "Red" } else { "Yellow" })
    Write-Host "Created Time: $($response.createdTime)" -ForegroundColor White
    Write-Host "Last Updated: $($response.lastUpdatedTime)" -ForegroundColor White
    
    if ($response.output) {
        Write-Host "Output: $($response.output)" -ForegroundColor White
    }
    
    if ($response.customStatus) {
        Write-Host "Custom Status: $($response.customStatus)" -ForegroundColor White
    }
    
    if ($response.runtimeStatus -eq "Failed" -and $response.output) {
        Write-Host "`nError Details:" -ForegroundColor Red
        Write-Host $response.output -ForegroundColor Red
    }
    
} catch {
    Write-Host "Failed to get status: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`nCompleted status check!" -ForegroundColor Green
