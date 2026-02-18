# Test Agent Emoji & Formatting Response
# Run this after updating the agent instructions in Azure AI Foundry

param(
    [Parameter()]
    [ValidateSet("dev", "prod", "local")]
    [string]$Environment = "dev"
)

# Set API URL based on environment
$apiUrl = switch ($Environment) {
    "local" { "http://localhost:5001/api/recommendations" }
    "dev"   { "https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net/api/recommendations" }
    "prod"  { "https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/recommendations" }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Agent Emoji & Formatting" -ForegroundColor Cyan
Write-Host "  Environment: $Environment" -ForegroundColor Cyan
Write-Host "  URL: $apiUrl" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test queries
$testQueries = @(
    "What's a good game for 4 players?",
    "Recommend a quick party game",
    "How do I set up Catan?"
)

foreach ($query in $testQueries) {
    Write-Host "Query: $query" -ForegroundColor Yellow
    Write-Host ("-" * 50) -ForegroundColor Gray
    
    $body = @{
        query = $query
        conversationId = "test-emoji-" + (Get-Date -Format "yyyyMMddHHmmss") + "-" + (Get-Random -Maximum 9999)
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
        
        $responseText = $response.response
        
        # Display response
        Write-Host "`nResponse:" -ForegroundColor Green
        Write-Host $responseText -ForegroundColor White
        
        # Check for emojis (surrogate pairs and common emoji ranges)
        $hasEmoji = $responseText -match "[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF]|[\u2700-\u27BF]"
        
        # Check for markdown formatting
        $hasBold = $responseText -match "\*\*[^*]+\*\*"
        $hasItalic = $responseText -match "(?<!\*)\*[^*]+\*(?!\*)"
        $hasBullets = $responseText -match "(?m)^[\s]*[-*+]\s+"
        $hasNumberedList = $responseText -match "(?m)^[\s]*\d+\.\s+"
        $hasHeaders = $responseText -match "(?m)^#{1,3}\s+"
        
        Write-Host "`nFormatting Analysis:" -ForegroundColor Yellow
        Write-Host "  Emojis:        $(if($hasEmoji){'✅ Found'}else{'❌ Not found'})" -ForegroundColor $(if($hasEmoji){"Green"}else{"Red"})
        Write-Host "  Bold (**):     $(if($hasBold){'✅ Found'}else{'❌ Not found'})" -ForegroundColor $(if($hasBold){"Green"}else{"Yellow"})
        Write-Host "  Italic (*):    $(if($hasItalic){'✅ Found'}else{'⚪ Not found'})" -ForegroundColor $(if($hasItalic){"Green"}else{"Gray"})
        Write-Host "  Bullets:       $(if($hasBullets){'✅ Found'}else{'⚪ Not found'})" -ForegroundColor $(if($hasBullets){"Green"}else{"Gray"})
        Write-Host "  Numbered List: $(if($hasNumberedList){'✅ Found'}else{'⚪ Not found'})" -ForegroundColor $(if($hasNumberedList){"Green"}else{"Gray"})
        Write-Host "  Headers (#):   $(if($hasHeaders){'✅ Found'}else{'⚪ Not found'})" -ForegroundColor $(if($hasHeaders){"Green"}else{"Gray"})
        
        $score = @($hasEmoji, $hasBold, $hasBullets).Where({$_}).Count
        Write-Host "`n  Overall Score: $score/3 key elements" -ForegroundColor $(if($score -ge 2){"Green"}elseif($score -eq 1){"Yellow"}else{"Red"})
        
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
    
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 50) -ForegroundColor Gray
    Write-Host ""
}

Write-Host "`nTesting Complete!" -ForegroundColor Green
Write-Host "If responses don't show emojis/formatting, update the agent instructions in Azure AI Foundry." -ForegroundColor Yellow
Write-Host "See: docs/agent_formatting_update.md for details." -ForegroundColor Yellow
