#!/usr/bin/env pwsh

Write-Host "🚀 Deploying diagnostic version to Production..." -ForegroundColor Cyan

# Push current changes to remote
Write-Host "📤 Pushing changes to remote repository..." -ForegroundColor Yellow
git push origin users/rajsin/v2.0

# Note: In a real deployment, you would trigger the Azure DevOps pipeline
# or use Azure CLI to deploy directly. For now, we'll provide instructions.

Write-Host "`n📋 Next Steps:" -ForegroundColor Green
Write-Host "1. The changes have been committed and can be deployed via Azure Pipeline" -ForegroundColor Gray
Write-Host "2. Or deploy manually using Azure CLI:" -ForegroundColor Gray
Write-Host "   az webapp deployment source sync --name gamer-uncle-prod-app-svc --resource-group gamer-uncle-prod-rg" -ForegroundColor White
Write-Host "3. Monitor Application Insights for diagnostic logs" -ForegroundColor Gray
Write-Host "4. This will show the actual Azure AI Agent responses in production" -ForegroundColor Gray

Write-Host "`nAfter deployment check Application Insights for diagnostic data" -ForegroundColor Green
