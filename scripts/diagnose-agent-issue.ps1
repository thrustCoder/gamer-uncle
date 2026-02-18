#!/usr/bin/env pwsh

# Direct Azure AI Agent Investigation Script

Write-Host "🔍 Azure AI Agent Investigation - Dev vs Prod" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check AI Foundry Projects
Write-Host "`n📋 Foundry Resources:" -ForegroundColor Yellow

$devFoundry = az cognitiveservices account show --name gamer-uncle-dev-foundry --resource-group gamer-uncle-dev-rg --query "{Name:name, Location:location, Endpoint:properties.endpoint}" | ConvertFrom-Json
$prodFoundry = az cognitiveservices account show --name gamer-uncle-prod-foundry-resourc --resource-group gamer-uncle-prod-rg --query "{Name:name, Location:location, Endpoint:properties.endpoint}" | ConvertFrom-Json

Write-Host "  DEV Foundry:  $($devFoundry.Name) ($($devFoundry.Location))" -ForegroundColor Green
Write-Host "  PROD Foundry: $($prodFoundry.Name) ($($prodFoundry.Location))" -ForegroundColor Green

if ($devFoundry.Location -ne $prodFoundry.Location) {
    Write-Host "  ⚠️  DIFFERENT REGIONS! This could cause model availability issues." -ForegroundColor Red
}

# Check Model Deployments
Write-Host "`n🤖 Model Deployments:" -ForegroundColor Yellow

$devDeployments = az cognitiveservices account deployment list --name gamer-uncle-dev-foundry --resource-group gamer-uncle-dev-rg --query "[].{Name:name, Model:properties.model.name, Version:properties.model.version, State:properties.provisioningState}" | ConvertFrom-Json
$prodDeployments = az cognitiveservices account deployment list --name gamer-uncle-prod-foundry-resourc --resource-group gamer-uncle-prod-rg --query "[].{Name:name, Model:properties.model.name, Version:properties.model.version, State:properties.provisioningState}" | ConvertFrom-Json

Write-Host "  DEV Deployments:" -ForegroundColor Green
foreach ($deployment in $devDeployments) {
    Write-Host "    - $($deployment.Name): $($deployment.Model) v$($deployment.Version) [$($deployment.State)]" -ForegroundColor White
}

Write-Host "  PROD Deployments:" -ForegroundColor Green  
foreach ($deployment in $prodDeployments) {
    Write-Host "    - $($deployment.Name): $($deployment.Model) v$($deployment.Version) [$($deployment.State)]" -ForegroundColor White
}

# Check if deployment names match
$devDeploymentNames = $devDeployments.Name
$prodDeploymentNames = $prodDeployments.Name

if (Compare-Object $devDeploymentNames $prodDeploymentNames) {
    Write-Host "  🚨 DEPLOYMENT NAMES DIFFER! This is likely the root cause." -ForegroundColor Red
    Write-Host "     Agent configurations may reference wrong deployment names." -ForegroundColor Red
}

# Configuration Analysis
Write-Host "`n⚙️  Configuration Analysis:" -ForegroundColor Yellow

$devConfig = Get-Content "services/api/appsettings.json" | ConvertFrom-Json
$prodConfig = Get-Content "services/api/appsettings.Production.json" | ConvertFrom-Json

Write-Host "  DEV Agent ID: $($devConfig.AgentService.AgentId)" -ForegroundColor Green
Write-Host "  PROD Agent ID: $($prodConfig.AgentService.AgentId)" -ForegroundColor Green

if ($devConfig.AgentService.AgentId -eq $prodConfig.AgentService.AgentId) {
    Write-Host "  ⚠️  SAME AGENT ID! This could be a configuration issue." -ForegroundColor Red
}

# Test API Response Quality
Write-Host "`n🧪 Response Quality Test:" -ForegroundColor Yellow

$testQuery = @{
    query = "Tell me about Ticket to Ride"
    userId = "test-user"
} | ConvertTo-Json

Write-Host "  Testing PROD API..." -ForegroundColor Gray
try {
    $prodResponse = Invoke-RestMethod -Uri "https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/Recommendations" -Method Post -Body $testQuery -ContentType "application/json" -ErrorAction Stop
    
    $isFallback = $prodResponse.responseText -match "Your query about"
    $hasGenericPatterns = $prodResponse.responseText -match "(Here are a few engaging board games|Catan.*trading.*expansion)"
    
    Write-Host "    Response Length: $($prodResponse.responseText.Length)" -ForegroundColor $(if ($prodResponse.responseText.Length -lt 300) { "Red" } else { "Green" })
    Write-Host "    Using Fallback: $(if ($isFallback) { "YES" } else { "NO" })" -ForegroundColor $(if ($isFallback) { "Red" } else { "Green" })
    Write-Host "    Has Generic Patterns: $(if ($hasGenericPatterns) { "YES" } else { "NO" })" -ForegroundColor $(if ($hasGenericPatterns) { "Red" } else { "Green" })
    
    if ($isFallback) {
        Write-Host "  🚨 CONFIRMED: Production is using fallback responses!" -ForegroundColor Red
    }
} catch {
    Write-Host "    ❌ Error testing PROD: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n💡 Recommendations:" -ForegroundColor Green
Write-Host "1. Check if agents in AI Foundry are using correct deployment names" -ForegroundColor Gray
Write-Host "2. Verify model deployment health in the deployed region" -ForegroundColor Gray  
Write-Host "3. Check Application Insights for 'AgentResponse.FallbackUsed' events" -ForegroundColor Gray
Write-Host "4. Consider standardizing deployment names between environments" -ForegroundColor Gray
