# Enable Swagger in Production App Service
# Run this script after logging into Azure CLI

Write-Host "🔧 Enabling Swagger in Production App Service..." -ForegroundColor Cyan

# Check if logged in to Azure
$account = az account show 2>$null
if (-not $account) {
    Write-Host "❌ Not logged in to Azure CLI. Please run 'az login' first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Azure CLI authenticated" -ForegroundColor Green

# Set Swagger configuration
Write-Host "Setting Swagger__Enabled=true in production App Service..." -ForegroundColor Yellow
az webapp config appsettings set `
  --name gamer-uncle-prod-app-svc `
  --resource-group gamer-uncle-prod-rg `
  --settings "Swagger__Enabled=true"

# Restart the app service to apply changes
Write-Host "Restarting App Service to apply changes..." -ForegroundColor Yellow
az webapp restart `
  --name gamer-uncle-prod-app-svc `
  --resource-group gamer-uncle-prod-rg

Write-Host "✅ Swagger should now be enabled at: https://gamer-uncle-prod-app-svc.azurewebsites.net/swagger" -ForegroundColor Green
Write-Host "💡 Wait 1-2 minutes for the app to restart before testing" -ForegroundColor Blue
