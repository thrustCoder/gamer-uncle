<#
.SYNOPSIS
    Toggles the dev App Service Plan between B1 (active) and F1 (parked/free) to save costs.

.DESCRIPTION
    Azure App Service Plans bill for the plan (VM) regardless of whether apps are running.
    Simply stopping the app (`az webapp stop`) does NOT save money on Basic+ tiers.
    
    This script scales the plan SKU:
    - "start" → B1 (Basic): Full features, ~$33/mo pro-rated by hours running
    - "stop"  → F1 (Free):  $0/mo, app stays deployed but sleeps after ~20 min
    
    Typical savings: $25–31/mo depending on testing hours.

    AFD health probes will mark the dev origin as unhealthy while parked on F1.
    This is expected and does not affect the prod environment.

.PARAMETER Action
    "start" to scale up to B1 for testing, "stop" to park on F1 (free).
    "status" to check the current SKU.

.EXAMPLE
    # Before testing:
    .\dev-appservice-toggle.ps1 start

    # After testing:
    .\dev-appservice-toggle.ps1 stop

    # Check current state:
    .\dev-appservice-toggle.ps1 status
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

$ResourceGroup = 'gamer-uncle-dev-rg'
$AppServicePlan = 'gamer-uncle-dev-app-plan'
$AppServiceName = 'gamer-uncle-dev-app-svc'
$ActiveSku = 'B1'
$ParkedSku = 'F1'

function Get-CurrentSku {
    $plan = az appservice plan show `
        --name $AppServicePlan `
        --resource-group $ResourceGroup `
        --query "sku.name" `
        --output tsv 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to query App Service Plan. Are you logged in? Run 'az login' first."
        exit 1
    }
    return $plan.Trim()
}

function Show-Status {
    $currentSku = Get-CurrentSku
    $state = if ($currentSku -eq $ActiveSku) { "ACTIVE (B1 — billing)" } 
             elseif ($currentSku -eq $ParkedSku) { "PARKED (F1 — free)" }
             else { "UNKNOWN ($currentSku)" }
    
    Write-Host ""
    Write-Host "  Dev App Service Plan: $AppServicePlan" -ForegroundColor Cyan
    Write-Host "  Current SKU:          $currentSku" -ForegroundColor Cyan
    Write-Host "  State:                $state" -ForegroundColor $(if ($currentSku -eq $ParkedSku) { "Green" } else { "Yellow" })
    Write-Host ""
}

switch ($Action) {
    'start' {
        $currentSku = Get-CurrentSku
        if ($currentSku -eq $ActiveSku) {
            Write-Host "`n  Already on $ActiveSku — no change needed.`n" -ForegroundColor Green
            exit 0
        }

        Write-Host "`n  Scaling $AppServicePlan from $currentSku -> $ActiveSku ..." -ForegroundColor Yellow
        $startTime = Get-Date

        az appservice plan update `
            --name $AppServicePlan `
            --resource-group $ResourceGroup `
            --sku $ActiveSku `
            --output none

        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to scale App Service Plan to $ActiveSku."
            exit 1
        }

        $elapsed = (Get-Date) - $startTime
        Write-Host "  Scaled to $ActiveSku in $([math]::Round($elapsed.TotalSeconds, 1))s" -ForegroundColor Green
        Write-Host "  Dev API is starting up (cold start may take 15-30s) ..." -ForegroundColor Yellow

        # Wait for the app to respond to health check
        Write-Host "  Waiting for health check ..." -ForegroundColor Yellow
        $healthy = $false
        for ($i = 0; $i -lt 12; $i++) {
            Start-Sleep -Seconds 5
            try {
                $response = az webapp show `
                    --name $AppServiceName `
                    --resource-group $ResourceGroup `
                    --query "state" `
                    --output tsv 2>&1
                if ($response.Trim() -eq "Running") {
                    $healthy = $true
                    break
                }
            } catch {
                # App still starting
            }
        }

        if ($healthy) {
            Write-Host "  Dev API is RUNNING and ready for testing.`n" -ForegroundColor Green
        } else {
            Write-Host "  App Service is scaled but health check timed out. Check the portal.`n" -ForegroundColor Yellow
        }
    }

    'stop' {
        $currentSku = Get-CurrentSku
        if ($currentSku -eq $ParkedSku) {
            Write-Host "`n  Already on $ParkedSku (free) — no change needed.`n" -ForegroundColor Green
            exit 0
        }

        Write-Host "`n  Scaling $AppServicePlan from $currentSku -> $ParkedSku (free) ..." -ForegroundColor Yellow
        $startTime = Get-Date

        az appservice plan update `
            --name $AppServicePlan `
            --resource-group $ResourceGroup `
            --sku $ParkedSku `
            --output none

        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to scale App Service Plan to $ParkedSku."
            exit 1
        }

        $elapsed = (Get-Date) - $startTime
        Write-Host "  Scaled to $ParkedSku (free) in $([math]::Round($elapsed.TotalSeconds, 1))s" -ForegroundColor Green
        Write-Host "  Dev API is now PARKED — no charges accruing.`n" -ForegroundColor Green
    }

    'status' {
        Show-Status
    }
}
