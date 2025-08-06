# Simple Function App Diagnostic Commands
# Run these commands one by one to check your function app setup

Write-Host "🔍 Simple Function App Diagnostics" -ForegroundColor Cyan
Write-Host "Run these commands individually:" -ForegroundColor Yellow

Write-Host "`n1. Check Function App exists:"
Write-Host "az functionapp show --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg" -ForegroundColor Gray

Write-Host "`n2. Check Managed Identity:"
Write-Host "az functionapp identity show --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg" -ForegroundColor Gray

Write-Host "`n3. Check Function App Settings:"
Write-Host "az functionapp config appsettings list --name gamer-uncle-prod-function --resource-group gamer-uncle-prod-rg" -ForegroundColor Gray

Write-Host "`n4. Check Cosmos DB Account:"
Write-Host "az cosmosdb show --name gamer-uncle-prod-cosmos --resource-group gamer-uncle-prod-rg" -ForegroundColor Gray

Write-Host "`n5. Check Cosmos DB Role Assignments (run after getting principal ID from step 2):"
Write-Host "az cosmosdb sql role assignment list --account-name gamer-uncle-prod-cosmos --resource-group gamer-uncle-prod-rg" -ForegroundColor Gray

Write-Host "`nWhat to look for:" -ForegroundColor Cyan
Write-Host "✅ Function app should exist and be 'Running'" -ForegroundColor Green
Write-Host "✅ Managed identity should be 'SystemAssigned' with a principal ID" -ForegroundColor Green
Write-Host "✅ Settings should include COSMOS_ENDPOINT, AZURE_TENANT_ID, AZURE_CLIENT_ID" -ForegroundColor Green
Write-Host "✅ New settings should include COSMOS_DATABASE_NAME, COSMOS_CONTAINER_NAME" -ForegroundColor Green
Write-Host "✅ Cosmos DB should exist and be accessible" -ForegroundColor Green
Write-Host "✅ Function app should have role assignments on Cosmos DB" -ForegroundColor Green
