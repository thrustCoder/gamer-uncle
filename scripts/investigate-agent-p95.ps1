param(
    [int]$Hours = 2
)

$ws = "5ae63b98-a993-499d-821b-12dcbbe5fe51"

Write-Host "=== Agent latency over last $Hours hour(s), 10-min buckets ===" -ForegroundColor Cyan
$q1 = "AppMetrics | where TimeGenerated > ago(${Hours}h) | where Name == 'AgentRequest.Duration' | summarize p50=percentile(Sum,50), p95=percentile(Sum,95), p99=percentile(Sum,99), maxv=max(Sum), n=count() by bin(TimeGenerated, 10m) | order by TimeGenerated desc"
az monitor log-analytics query --workspace $ws --analytics-query $q1 -o table

Write-Host ""
Write-Host "=== Slowest 20 agent requests in last $Hours hour(s) ===" -ForegroundColor Cyan
$q2 = "AppRequests | where TimeGenerated > ago(${Hours}h) | where Name has 'Agent' or Name has 'recommend' | top 20 by DurationMs desc | project TimeGenerated, Name, DurationMs, ResultCode, OperationId, Url"
az monitor log-analytics query --workspace $ws --analytics-query $q2 -o table

Write-Host ""
Write-Host "=== Recommendations endpoint latency ===" -ForegroundColor Cyan
$q3 = "AppRequests | where TimeGenerated > ago(${Hours}h) | where Url has 'recommendations' or Name has 'Recommendations' | summarize n=count(), p50=percentile(DurationMs,50), p95=percentile(DurationMs,95), p99=percentile(DurationMs,99), maxv=max(DurationMs), errors=countif(Success == false) by bin(TimeGenerated, 10m) | order by TimeGenerated desc"
az monitor log-analytics query --workspace $ws --analytics-query $q3 -o table

Write-Host ""
Write-Host "=== Slow dependencies (>3s) in last $Hours hour(s) ===" -ForegroundColor Cyan
$q4 = "AppDependencies | where TimeGenerated > ago(${Hours}h) | where DurationMs > 3000 | summarize n=count(), p50=percentile(DurationMs,50), p95=percentile(DurationMs,95), maxv=max(DurationMs) by Type, Target | order by p95 desc | take 30"
az monitor log-analytics query --workspace $ws --analytics-query $q4 -o table

Write-Host ""
Write-Host "=== Agent exceptions (last $Hours hour(s)) ===" -ForegroundColor Cyan
$q5 = "AppExceptions | where TimeGenerated > ago(${Hours}h) | summarize n=count() by ProblemId, OuterMessage | order by n desc | take 20"
az monitor log-analytics query --workspace $ws --analytics-query $q5 -o table

Write-Host ""
Write-Host "=== Hourly P95 trend (last 7 days) ===" -ForegroundColor Cyan
$q6 = "AppMetrics | where TimeGenerated > ago(7d) | where Name == 'AgentRequest.Duration' | summarize p95=percentile(Sum,95), n=count() by bin(TimeGenerated, 1h) | where n > 0 | order by TimeGenerated desc | take 40"
az monitor log-analytics query --workspace $ws --analytics-query $q6 -o table
