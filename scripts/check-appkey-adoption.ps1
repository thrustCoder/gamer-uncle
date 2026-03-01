<#
.SYNOPSIS
    Queries Application Insights to measure App Key adoption on Recommendations & Voice endpoints.
    Used to determine Phase 4 readiness (hard enforcement) of the App Key rollout.

.DESCRIPTION
    Runs two KQL queries against the prod Application Insights traces table:
      1. Outcome breakdown (Valid / Missing / Invalid) over the last 30 days.
      2. Daily trend of Missing-key requests to track adoption over time.

    The filter emits structured ILogger traces with EventId 7001–7003 and
    customDimensions containing AppKeyOutcome, AppKeyPath, ClientIp, UserAgent.

    Phase 4 prerequisite: Missing < 1% of total (Valid + Missing).

.PARAMETER Days
    Number of days to look back. Default: 30.

.PARAMETER Environment
    Which environment to query. Default: prod.

.EXAMPLE
    .\check-appkey-adoption.ps1
    .\check-appkey-adoption.ps1 -Days 7
    .\check-appkey-adoption.ps1 -Environment dev
#>
param(
    [int]$Days = 30,
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod"
)

$ErrorActionPreference = "Stop"

$appInsightsName = "gamer-uncle-$Environment-app-insights"
$resourceGroup   = "gamer-uncle-$Environment-rg"

Write-Host "`n=== App Key Adoption Report ($Environment, last $Days days) ===" -ForegroundColor Cyan
Write-Host ""

# ── Query 1: Outcome breakdown ────────────────────────────────────────────────
$kqlSummary = @"
traces
| where timestamp > ago(${Days}d)
| where customDimensions has 'AppKeyOutcome'
| extend Outcome = tostring(customDimensions['AppKeyOutcome']),
         Path    = tostring(customDimensions['AppKeyPath'])
| summarize Count=count() by Outcome
| order by Count desc
"@

Write-Host "1. Outcome Summary" -ForegroundColor Yellow
$summaryResult = az monitor app-insights query `
    --app $appInsightsName `
    --resource-group $resourceGroup `
    --analytics-query $kqlSummary `
    -o json 2>&1 | ConvertFrom-Json

$rows = $summaryResult.tables[0].rows
if ($rows.Count -eq 0) {
    Write-Host "   No grace-mode telemetry found. Either no traffic or telemetry not yet deployed." -ForegroundColor Red
}
else {
    $total = ($rows | ForEach-Object { $_[1] } | Measure-Object -Sum).Sum
    foreach ($row in $rows) {
        $outcome = $row[0]
        $count   = $row[1]
        $pct     = [math]::Round(($count / $total) * 100, 1)
        $color   = if ($outcome -eq "Missing") { "Red" } elseif ($outcome -eq "Valid") { "Green" } else { "Yellow" }
        Write-Host "   $outcome : $count ($pct%)" -ForegroundColor $color
    }
    Write-Host "   Total  : $total" -ForegroundColor White

    $missingCount = ($rows | Where-Object { $_[0] -eq "Missing" } | ForEach-Object { $_[1] } | Measure-Object -Sum).Sum
    $missingPct   = if ($total -gt 0) { [math]::Round(($missingCount / $total) * 100, 1) } else { 0 }

    Write-Host ""
    if ($missingPct -lt 1) {
        Write-Host "   ✅ Phase 4 READY: Missing keys < 1% ($missingPct%)" -ForegroundColor Green
    }
    else {
        Write-Host "   ⏳ Phase 4 NOT READY: Missing keys = $missingPct% (target < 1%)" -ForegroundColor Yellow
    }
}

# ── Query 2: Daily trend ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "2. Daily Missing-Key Trend (last $Days days)" -ForegroundColor Yellow

$kqlTrend = @"
traces
| where timestamp > ago(${Days}d)
| where customDimensions has 'AppKeyOutcome'
| extend Outcome = tostring(customDimensions['AppKeyOutcome'])
| summarize Total=count(), Missing=countif(Outcome == 'Missing') by bin(timestamp, 1d)
| extend MissingPct = round(todouble(Missing) / todouble(Total) * 100, 1)
| order by timestamp asc
| project Day=format_datetime(timestamp, 'yyyy-MM-dd'), Total, Missing, MissingPct
"@

$trendResult = az monitor app-insights query `
    --app $appInsightsName `
    --resource-group $resourceGroup `
    --analytics-query $kqlTrend `
    -o json 2>&1 | ConvertFrom-Json

$trendRows = $trendResult.tables[0].rows
if ($trendRows.Count -eq 0) {
    Write-Host "   No daily data available yet." -ForegroundColor DarkGray
}
else {
    Write-Host "   Date         Total  Missing  Missing%" -ForegroundColor Gray
    Write-Host "   ----------   -----  -------  --------" -ForegroundColor Gray
    foreach ($row in $trendRows) {
        $day  = $row[0]
        $tot  = $row[1]
        $miss = $row[2]
        $pct  = $row[3]
        $color = if ($pct -lt 1) { "Green" } elseif ($pct -lt 5) { "Yellow" } else { "Red" }
        Write-Host ("   {0}   {1,5}  {2,7}  {3,7}%" -f $day, $tot, $miss, $pct) -ForegroundColor $color
    }
}

# ── Query 3: Also check customEvents (belt-and-suspenders) ───────────────────
Write-Host ""
Write-Host "3. Custom Events Check (TelemetryClient path)" -ForegroundColor Yellow

$kqlEvents = @"
customEvents
| where timestamp > ago(${Days}d)
| where name == 'AppKey.GraceModeRequest'
| summarize Count=count() by tostring(customDimensions['Outcome'])
| order by Count desc
"@

$eventsResult = az monitor app-insights query `
    --app $appInsightsName `
    --resource-group $resourceGroup `
    --analytics-query $kqlEvents `
    -o json 2>&1 | ConvertFrom-Json

$eventRows = $eventsResult.tables[0].rows
if ($eventRows.Count -eq 0) {
    Write-Host "   No customEvents found (expected if classic SDK channel is not wired)." -ForegroundColor DarkGray
    Write-Host "   Traces table is the primary data source." -ForegroundColor DarkGray
}
else {
    foreach ($row in $eventRows) {
        Write-Host "   $($row[0]) : $($row[1])" -ForegroundColor White
    }
}

Write-Host ""
