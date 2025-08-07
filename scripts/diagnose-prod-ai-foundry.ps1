# Azure AI Foundry Production Diagnostic Script
# This script diagnoses the Azure AI Foundry endpoint connectivity issue

param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$AppServiceName = "gamer-uncle-prod-app-svc",
    [string]$FoundryEndpoint = "https://gamer-uncle-prod-foundry.services.ai.azure.com/api/projects/gamer-uncle-prod-foundry-project"
)

Write-Host "Azure AI Foundry Production Diagnostics" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Check if we can access Azure CLI
Write-Host "`n1. Checking Azure CLI connection..." -ForegroundColor Yellow
try {
    $account = az account show | ConvertFrom-Json
    Write-Host "✅ Connected to Azure subscription: $($account.name)" -ForegroundColor Green
    Write-Host "   Tenant: $($account.tenantId)" -ForegroundColor White
} catch {
    Write-Host "❌ Not logged into Azure CLI. Please run 'az login'" -ForegroundColor Red
    exit 1
}

# 2. Check App Service configuration
Write-Host "`n2. Checking App Service Configuration..." -ForegroundColor Yellow
try {
    $appService = az webapp show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "✅ App Service exists: $($appService.name)" -ForegroundColor Green
    Write-Host "   State: $($appService.state)" -ForegroundColor White
    Write-Host "   Location: $($appService.location)" -ForegroundColor White
} catch {
    Write-Host "❌ App Service not found or inaccessible" -ForegroundColor Red
    exit 1
}

# 3. Check current app settings for AI Foundry configuration
Write-Host "`n3. Checking App Service Settings..." -ForegroundColor Yellow
$settings = az webapp config appsettings list --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json

$aiFoundrySettings = @("AgentService__Endpoint", "AgentService__AgentId")
foreach ($setting in $aiFoundrySettings) {
    $configValue = $settings | Where-Object { $_.name -eq $setting }
    if ($configValue) {
        Write-Host "✅ $setting = $($configValue.value)" -ForegroundColor Green
    } else {
        Write-Host "❌ $setting is MISSING" -ForegroundColor Red
    }
}

# 4. Test DNS resolution for the foundry endpoint
Write-Host "`n4. Testing DNS Resolution..." -ForegroundColor Yellow
$foundryHost = ([System.Uri]$FoundryEndpoint).Host
Write-Host "   Testing host: $foundryHost" -ForegroundColor White

try {
    $dnsResult = Resolve-DnsName -Name $foundryHost -ErrorAction Stop
    Write-Host "✅ DNS resolution successful" -ForegroundColor Green
    foreach ($result in $dnsResult) {
        Write-Host "   $($result.Type): $($result.IPAddress)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ DNS resolution failed for $foundryHost" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test HTTP connectivity to the foundry endpoint
Write-Host "`n5. Testing HTTP Connectivity..." -ForegroundColor Yellow
try {
    Write-Host "   Testing connection to: $FoundryEndpoint" -ForegroundColor White
    $response = Invoke-WebRequest -Uri $FoundryEndpoint -Method HEAD -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ HTTP connection successful" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "❌ HTTP connection failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to extract more specific error information
    if ($_.Exception.Message -like "*No such host is known*") {
        Write-Host "This indicates a DNS resolution issue" -ForegroundColor Yellow
    } elseif ($_.Exception.Message -like "*connection refused*") {
        Write-Host "This indicates the service is not running or not accessible" -ForegroundColor Yellow
    } elseif ($_.Exception.Message -like "*timeout*") {
        Write-Host "This indicates a network connectivity or firewall issue" -ForegroundColor Yellow
    }
}

# 6. Check for Azure AI Studio/Foundry resources in the subscription
Write-Host "`n6. Searching for Azure AI Resources..." -ForegroundColor Yellow
try {
    # Look for AI Studio/Foundry related resources
    $aiResources = az resource list --resource-group $ResourceGroup --query "[?contains(type, 'MachineLearning') || contains(type, 'CognitiveServices')]" | ConvertFrom-Json
    
    if ($aiResources.Count -gt 0) {
        Write-Host "✅ Found AI-related resources:" -ForegroundColor Green
        foreach ($resource in $aiResources) {
            Write-Host "   - $($resource.name) ($($resource.type))" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  No AI-related resources found in resource group" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Failed to search for AI resources" -ForegroundColor Yellow
}

# 7. Check managed identity configuration
Write-Host "`n7. Checking App Service Managed Identity..." -ForegroundColor Yellow
try {
    $identity = az webapp identity show --name $AppServiceName --resource-group $ResourceGroup | ConvertFrom-Json
    
    if ($identity.type -eq "SystemAssigned") {
        Write-Host "✅ System-assigned managed identity is enabled" -ForegroundColor Green
        Write-Host "   Principal ID: $($identity.principalId)" -ForegroundColor White
    } else {
        Write-Host "❌ Managed identity not configured" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to check managed identity" -ForegroundColor Red
}

# 8. Summary and recommendations
Write-Host "`nSummary and Recommendations:" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

Write-Host "`nBased on the diagnostics above, here are the likely issues:" -ForegroundColor Yellow

Write-Host "`n1. Azure AI Foundry Service Missing:" -ForegroundColor White
Write-Host "   The endpoint '$foundryHost' is not resolving, which suggests:" -ForegroundColor White
Write-Host "   - The Azure AI Foundry service for production was never created" -ForegroundColor White
Write-Host "   - The service exists but in a different resource group or subscription" -ForegroundColor White
Write-Host "   - The domain name in configuration is incorrect" -ForegroundColor White

Write-Host "`n2. Required Actions:" -ForegroundColor White
Write-Host "   a) Create Azure AI Foundry service in production environment" -ForegroundColor White
Write-Host "   b) Update production configuration with correct endpoint" -ForegroundColor White
Write-Host "   c) Ensure managed identity has access to the AI Foundry service" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Blue
Write-Host "1. Check if Azure AI Foundry for production exists in Azure Portal" -ForegroundColor Blue
Write-Host "2. If it doesn't exist, create it following the same pattern as dev environment" -ForegroundColor Blue
Write-Host "3. Update the production appsettings.json with the correct endpoint" -ForegroundColor Blue
Write-Host "4. Redeploy the API with updated configuration" -ForegroundColor Blue

Write-Host "`nUseful Commands to run after fixing:" -ForegroundColor Green
Write-Host "# Update app settings after creating AI Foundry:" -ForegroundColor Green
Write-Host "az webapp config appsettings set \\" -ForegroundColor Green
Write-Host "  --name $AppServiceName \\" -ForegroundColor Green
Write-Host "  --resource-group $ResourceGroup \\" -ForegroundColor Green
Write-Host "  --settings 'AgentService__Endpoint=https://YOUR-CORRECT-ENDPOINT'" -ForegroundColor Green

Write-Host "`nDiagnosis Complete!" -ForegroundColor Cyan
