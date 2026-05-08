$ws = "5ae63b98-a993-499d-821b-12dcbbe5fe51"

Write-Host "=== Alert rule definition ===" -ForegroundColor Cyan
az monitor scheduled-query show --resource-group "gamer-uncle-prod-rg" --name "gamer-uncle-prod-agent-duration-p95" --query "{enabled:enabled, severity:severity, evaluationFrequency:evaluationFrequency, windowSize:windowSize, criteria:criteria}" -o json

Write-Host ""
Write-Host "=== All AgentRequest.Duration data points last 7 days ===" -ForegroundColor Cyan
$q = "AppMetrics | where TimeGenerated > ago(7d) | where Name == 'AgentRequest.Duration' | project TimeGenerated, Sum, ItemCount, Min, Max, AppRoleName, AppRoleInstance, _ResourceId | order by TimeGenerated desc"
az monitor log-analytics query --workspace $ws --analytics-query $q -o table

Write-Host ""
Write-Host "=== Requests around 2026-05-05 16:00-17:30 UTC ===" -ForegroundColor Cyan
$q2 = "AppRequests | where TimeGenerated between (datetime(2026-05-05T15:30:00Z) .. datetime(2026-05-05T17:30:00Z)) | project TimeGenerated, Name, DurationMs, ResultCode, Success, Url, OperationId, AppRoleInstance | order by DurationMs desc | take 50"
az monitor log-analytics query --workspace $ws --analytics-query $q2 -o table

Write-Host ""
Write-Host "=== Dependencies around 2026-05-05 16:00-17:30 UTC ===" -ForegroundColor Cyan
$q3 = "AppDependencies | where TimeGenerated between (datetime(2026-05-05T15:30:00Z) .. datetime(2026-05-05T17:30:00Z)) | where DurationMs > 1000 | project TimeGenerated, Name, Type, Target, DurationMs, Success, ResultCode, OperationId | order by DurationMs desc | take 50"
az monitor log-analytics query --workspace $ws --analytics-query $q3 -o table

Write-Host ""
Write-Host "=== Traces (warnings+) around incident ===" -ForegroundColor Cyan
$q4 = "AppTraces | where TimeGenerated between (datetime(2026-05-05T15:30:00Z) .. datetime(2026-05-05T17:30:00Z)) | where SeverityLevel >= 2 | project TimeGenerated, Message, SeverityLevel, OperationId, Properties | order by TimeGenerated desc | take 50"
az monitor log-analytics query --workspace $ws --analytics-query $q4 -o table
