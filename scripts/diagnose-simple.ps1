# Simplified Azure Function Managed Identity Diagnostic
param(
    [string]$ResourceGroup = "gamer-uncle-prod-rg",
    [string]$FunctionAppName = "gamer-uncle-prod-function"
)

Write-Host "Checking Function App Identity Configuration" -ForegroundColor Cyan

# Check Function App managed identity
Write-Host "`n1. Checking managed identity..." -ForegroundColor Yellow
$identity = az functionapp identity show --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json

if ($identity.type -like "*SystemAssigned*") {
    Write-Host "System-assigned managed identity enabled" -ForegroundColor Green
    Write-Host "   Principal ID: $($identity.principalId)" -ForegroundColor White
    $principalId = $identity.principalId
} else {
    Write-Host "No system-assigned managed identity found" -ForegroundColor Red
    Write-Host "   This is likely the root cause!" -ForegroundColor Red
    Write-Host "`nFix: Enable managed identity:" -ForegroundColor Yellow
    Write-Host "   az functionapp identity assign --name $FunctionAppName --resource-group $ResourceGroup" -ForegroundColor Gray
    exit 1
}

# Check environment variables
Write-Host "`n2. Checking environment variables..." -ForegroundColor Yellow
$appSettings = az functionapp config appsettings list --name $FunctionAppName --resource-group $ResourceGroup | ConvertFrom-Json

$requiredVars = @("COSMOS_ENDPOINT", "COSMOS_DATABASE_NAME", "AZURE_TENANT_ID")
foreach ($var in $requiredVars) {
    $setting = $appSettings | Where-Object { $_.name -eq $var }
    if ($setting) {
        Write-Host "   $var is set" -ForegroundColor Green
    } else {
        Write-Host "   $var is missing" -ForegroundColor Red
    }
}

# Get Cosmos account name
$cosmosEndpoint = ($appSettings | Where-Object { $_.name -eq "COSMOS_ENDPOINT" }).value
if ($cosmosEndpoint) {
    $cosmosAccountName = $cosmosEndpoint.Replace("https://", "").Split(".")[0]
    Write-Host "`n3. Cosmos Account: $cosmosAccountName" -ForegroundColor White
    
    # Check RBAC assignments
    Write-Host "`n4. Checking RBAC assignments..." -ForegroundColor Yellow
    $cosmosAccounts = az cosmosdb list | ConvertFrom-Json
    $cosmosAccount = $cosmosAccounts | Where-Object { $_.name -eq $cosmosAccountName }
    
    if ($cosmosAccount) {
        $roleAssignments = az role assignment list --assignee $principalId --scope $cosmosAccount.id | ConvertFrom-Json
        
        if ($roleAssignments.Count -gt 0) {
            Write-Host "   Found RBAC assignments:" -ForegroundColor Green
            foreach ($assignment in $roleAssignments) {
                Write-Host "     - $($assignment.roleDefinitionName)" -ForegroundColor White
            }
        } else {
            Write-Host "   No RBAC assignments found!" -ForegroundColor Red
            Write-Host "   This is the likely cause of the authentication failure" -ForegroundColor Red
            Write-Host "`nFix: Assign Cosmos DB role:" -ForegroundColor Yellow
            Write-Host "   az cosmosdb sql role assignment create \\" -ForegroundColor Gray
            Write-Host "     --account-name $cosmosAccountName \\" -ForegroundColor Gray
            Write-Host "     --resource-group $($cosmosAccount.resourceGroup) \\" -ForegroundColor Gray
            Write-Host "     --scope '/' \\" -ForegroundColor Gray
            Write-Host "     --principal-id $principalId \\" -ForegroundColor Gray
            Write-Host "     --role-definition-name 'Cosmos DB Built-in Data Contributor'" -ForegroundColor Gray
        }
    } else {
        Write-Host "   Cosmos account not found in current subscription" -ForegroundColor Yellow
    }
}

Write-Host "`nDiagnostic completed!" -ForegroundColor Green
