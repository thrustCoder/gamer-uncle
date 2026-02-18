<#
.SYNOPSIS
    Configures autoscaling rules for App Service Plans.

.DESCRIPTION
    Sets up autoscale rules on the production App Service Plan (P1v3).
    Dev (B1/Basic) does not support autoscaling — only Standard tier and above.

    Rules:
    - Min instances: 2, Max instances: 4
    - Scale OUT: Add 1 instance when avg CPU > 70% over 5 minutes
    - Scale IN: Remove 1 instance when avg CPU < 30% over 10 minutes
    - Cooldown: 5 minutes between scale actions

.PARAMETER Environment
    Target environment: 'prod' (default) or 'dev'.
    Dev will fail unless the plan has been upgraded to Standard or higher.

.PARAMETER DryRun
    If set, prints the commands without executing them.

.EXAMPLE
    .\configure-autoscale.ps1
    .\configure-autoscale.ps1 -Environment prod
    .\configure-autoscale.ps1 -DryRun
#>

param(
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'prod',

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Environment-specific configuration
$config = @{
    'dev' = @{
        ResourceGroup   = 'gamer-uncle-dev-rg'
        AppServicePlan  = 'gamer-uncle-dev-app-plan'
        AutoscaleName   = 'gamer-uncle-dev-autoscale'
        MinInstances    = 1
        MaxInstances    = 2
        DefaultInstances = 1
    }
    'prod' = @{
        ResourceGroup   = 'gamer-uncle-prod-rg'
        AppServicePlan  = 'gamer-uncle-prod-app-plan'
        AutoscaleName   = 'gamer-uncle-prod-autoscale'
        MinInstances    = 2
        MaxInstances    = 4
        DefaultInstances = 2
    }
}

$env_config = $config[$Environment]

Write-Host "=== Autoscale Configuration ===" -ForegroundColor Cyan
Write-Host "Environment : $Environment"
Write-Host "Resource Group : $($env_config.ResourceGroup)"
Write-Host "App Service Plan: $($env_config.AppServicePlan)"
Write-Host "Min Instances : $($env_config.MinInstances)"
Write-Host "Max Instances : $($env_config.MaxInstances)"
Write-Host "Default Instances: $($env_config.DefaultInstances)"
Write-Host ""

# Verify the App Service Plan exists and supports autoscaling
Write-Host "Checking App Service Plan tier..." -ForegroundColor Yellow
$planJson = az appservice plan show --name $env_config.AppServicePlan --resource-group $env_config.ResourceGroup --query "{sku:sku.name, tier:sku.tier}" -o json 2>$null
$planInfo = $planJson | ConvertFrom-Json

if (-not $planInfo) {
    Write-Error "App Service Plan '$($env_config.AppServicePlan)' not found in resource group '$($env_config.ResourceGroup)'"
    exit 1
}

$unsupportedTiers = @('Free', 'Shared', 'Basic')
if ($unsupportedTiers -contains $planInfo.tier) {
    Write-Error "App Service Plan is on '$($planInfo.tier)' tier ($($planInfo.sku)). Autoscaling requires Standard (S1+), Premium, or Isolated tier."
    exit 1
}

Write-Host "Plan tier: $($planInfo.tier) ($($planInfo.sku)) - autoscaling supported" -ForegroundColor Green

# Get the App Service Plan resource ID
$planId = az appservice plan show --name $env_config.AppServicePlan --resource-group $env_config.ResourceGroup --query "id" -o tsv 2>$null

if (-not $planId) {
    Write-Error "Could not retrieve resource ID for App Service Plan"
    exit 1
}

$planId = $planId.Trim()
Write-Host "Resource ID: $planId" -ForegroundColor Gray

# Check for existing autoscale settings
Write-Host ""
Write-Host "Checking for existing autoscale settings..." -ForegroundColor Yellow
$existingAutoscale = $null
try {
    $ErrorActionPreference = 'SilentlyContinue'
    $existingAutoscale = az monitor autoscale show --name $env_config.AutoscaleName --resource-group $env_config.ResourceGroup -o json 2>$null
    $ErrorActionPreference = 'Stop'
} catch {
    $ErrorActionPreference = 'Stop'
}

if ($existingAutoscale) {
    Write-Host "Existing autoscale setting found. It will be updated." -ForegroundColor Yellow
} else {
    Write-Host "No existing autoscale settings found. Creating new." -ForegroundColor Green
}

if ($DryRun) {
    Write-Host ""
    Write-Host "=== DRY RUN - Commands that would be executed ===" -ForegroundColor Magenta
    Write-Host "1. az monitor autoscale create (min=$($env_config.MinInstances), max=$($env_config.MaxInstances), default=$($env_config.DefaultInstances))"
    Write-Host "2. az monitor autoscale rule create - Scale OUT: CPU > 70% avg over 5 min -> add 1 instance, cooldown 5 min"
    Write-Host "3. az monitor autoscale rule create - Scale IN: CPU < 30% avg over 10 min -> remove 1 instance, cooldown 5 min"
    Write-Host ""
    Write-Host "No changes made." -ForegroundColor Magenta
    exit 0
}

# Step 1: Create or update the autoscale setting with instance limits
Write-Host ""
Write-Host "Step 1: Creating autoscale setting..." -ForegroundColor Yellow

$minCount = $env_config.MinInstances
$maxCount = $env_config.MaxInstances
$defaultCount = $env_config.DefaultInstances

az monitor autoscale create --name $env_config.AutoscaleName --resource-group $env_config.ResourceGroup --resource $planId --min-count $minCount --max-count $maxCount --count $defaultCount --output none

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create autoscale setting"
    exit 1
}
Write-Host "Autoscale setting created (min=$minCount, max=$maxCount, default=$defaultCount)" -ForegroundColor Green

# Step 2: Add scale-out rule (CPU > 70% for 5 minutes -> add 1 instance)
Write-Host ""
Write-Host "Step 2: Adding scale-out rule (CPU > 70%)..." -ForegroundColor Yellow

az monitor autoscale rule create --autoscale-name $env_config.AutoscaleName --resource-group $env_config.ResourceGroup --condition "CpuPercentage > 70 avg 5m" --scale out 1 --cooldown 5 --output none

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create scale-out rule"
    exit 1
}
Write-Host "Scale-out rule created: CPU > 70% avg over 5 min -> +1 instance (5 min cooldown)" -ForegroundColor Green

# Step 3: Add scale-in rule (CPU < 30% for 10 minutes -> remove 1 instance)
Write-Host ""
Write-Host "Step 3: Adding scale-in rule (CPU < 30%)..." -ForegroundColor Yellow

az monitor autoscale rule create --autoscale-name $env_config.AutoscaleName --resource-group $env_config.ResourceGroup --condition "CpuPercentage < 30 avg 10m" --scale in 1 --cooldown 5 --output none

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create scale-in rule"
    exit 1
}
Write-Host "Scale-in rule created: CPU < 30% avg over 10 min -> -1 instance (5 min cooldown)" -ForegroundColor Green

# Verify the configuration
Write-Host ""
Write-Host "=== Verifying Autoscale Configuration ===" -ForegroundColor Cyan

$verifyJson = az monitor autoscale show --name $env_config.AutoscaleName --resource-group $env_config.ResourceGroup --query "{enabled:enabled, minCapacity:profiles[0].capacity.minimum, maxCapacity:profiles[0].capacity.maximum, ruleCount:length(profiles[0].rules)}" -o json 2>$null
$autoscaleInfo = $verifyJson | ConvertFrom-Json

Write-Host "Enabled       : $($autoscaleInfo.enabled)"
Write-Host "Min Capacity  : $($autoscaleInfo.minCapacity)"
Write-Host "Max Capacity  : $($autoscaleInfo.maxCapacity)"
Write-Host "Rules Count   : $($autoscaleInfo.ruleCount)"
Write-Host ""
Write-Host "Autoscaling configured successfully for $Environment!" -ForegroundColor Green
