# Immediate fix for Azure Function authentication issues
# This script updates the function app settings and assigns necessary RBAC roles

Write-Host "🔧 Fixing Azure Function Authentication Issues..." -ForegroundColor Cyan

# 1. Update Function App Settings with correct database names
Write-Host "`n1. Updating Function App Settings..." -ForegroundColor Yellow
az functionapp config appsettings set `
  --name gamer-uncle-prod-function `
  --resource-group gamer-uncle-prod-rg `
  --settings `
    'COSMOS_DATABASE_NAME=gamer-uncle-prod-cosmos-container' `
    'COSMOS_CONTAINER_NAME=Games'

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Function app settings updated successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to update function app settings" -ForegroundColor Red
    exit 1
}

# 2. Get the function app's managed identity principal ID
Write-Host "`n2. Getting Function App Managed Identity..." -ForegroundColor Yellow
$identity = az functionapp identity show --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg | ConvertFrom-Json

if ($identity.type -eq "SystemAssigned") {
    $principalId = $identity.principalId
    Write-Host "✅ Found managed identity: $principalId" -ForegroundColor Green
} else {
    Write-Host "❌ Managed identity not configured - enabling it now..." -ForegroundColor Red
    az functionapp identity assign --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg
    
    # Get the newly created identity
    $identity = az functionapp identity show --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg | ConvertFrom-Json
    $principalId = $identity.principalId
    Write-Host "✅ Managed identity enabled: $principalId" -ForegroundColor Green
}

# 3. Assign Cosmos DB Data Contributor role to the function app
Write-Host "`n3. Assigning Cosmos DB Role..." -ForegroundColor Yellow

# Get subscription ID
$subscriptionId = az account show --query id -o tsv

# Assign the Cosmos DB Built-in Data Contributor role
$cosmosScope = "/subscriptions/$subscriptionId/resourceGroups/gamer-uncle-prod-rg/providers/Microsoft.DocumentDB/databaseAccounts/gamer-uncle-prod-cosmos"

Write-Host "Assigning Cosmos DB Built-in Data Contributor role..."
az cosmosdb sql role assignment create `
  --account-name gamer-uncle-prod-cosmos `
  --resource-group gamer-uncle-prod-rg `
  --scope "/" `
  --principal-id $principalId `
  --role-definition-id "00000000-0000-0000-0000-000000000002"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cosmos DB role assigned successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Role assignment may have failed or already exists" -ForegroundColor Yellow
}

# 4. Verify settings
Write-Host "`n4. Verifying Current Settings..." -ForegroundColor Yellow
az functionapp config appsettings list `
  --name gamer-uncle-prod-function `
  --resource-group gamer-uncle-prod-rg `
  --query "[?name=='COSMOS_ENDPOINT' || name=='COSMOS_DATABASE_NAME' || name=='COSMOS_CONTAINER_NAME' || name=='AZURE_TENANT_ID' || name=='AZURE_CLIENT_ID']" `
  -o table

Write-Host "`n✅ Fix completed! The function should now authenticate properly." -ForegroundColor Green
Write-Host "💡 The function will need to restart to pick up the new settings." -ForegroundColor Blue
Write-Host "💡 You can restart it with: az functionapp restart --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg" -ForegroundColor Blue
