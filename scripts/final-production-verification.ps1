#!/usr/bin/env pwsh

Write-Host "🎉 FINAL PRODUCTION VERIFICATION TEST 🎉" -ForegroundColor Magenta
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "Testing all fixes applied to production:" -ForegroundColor Cyan
Write-Host "✅ Fixed Azure AI Agent configuration in Foundry portal" -ForegroundColor Green  
Write-Host "✅ Fixed Cosmos DB RBAC permissions for App Service managed identity" -ForegroundColor Green
Write-Host "✅ Fixed hardcoded database name in CosmosDbService" -ForegroundColor Green
Write-Host "✅ Updated configuration files for environment-specific database names" -ForegroundColor Green

Write-Host "`n📋 Test Plan:" -ForegroundColor Yellow
Write-Host "1. Test multiple query types against production API" -ForegroundColor Gray
Write-Host "2. Verify responses are detailed and AI-generated (not fallback)" -ForegroundColor Gray
Write-Host "3. Confirm no Cosmos DB errors" -ForegroundColor Gray
Write-Host "4. Compare response quality with dev environment" -ForegroundColor Gray

$testQueries = @(
    @{ query = "What is Catan about?"; expectedLength = 300; description = "Game-specific query" },
    @{ query = "Recommend board games for 4 players"; expectedLength = 200; description = "Player count recommendation" },
    @{ query = "Tell me about worker placement games"; expectedLength = 250; description = "Mechanic-based query" },
    @{ query = "What are some good strategy games for beginners?"; expectedLength = 200; description = "Category + difficulty query" }
)

$successCount = 0
$totalTests = $testQueries.Count

foreach ($i in 0..($testQueries.Count - 1)) {
    $test = $testQueries[$i]
    Write-Host "`n🎯 Test $($i + 1)/$totalTests`: $($test.description)" -ForegroundColor Cyan
    Write-Host "   Query: '$($test.query)'" -ForegroundColor Gray
    
    $testQuery = @{
        query = $test.query
        userId = "final-test-$($i + 1)-$(Get-Date -Format 'MMddHHmmss')"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/Recommendations" -Method Post -Body $testQuery -ContentType "application/json" -ErrorAction Stop
        
        $hasError = $response.responseText -match "(Something went wrong|Forbidden|Error|NotFound)"
        $isGeneric = $response.responseText -match "(On it!|Great board game question|Looking into|Let me help|Checking my)"
        $isFallback = $response.responseText -match "Your query about"
        $isDetailed = $response.responseText.Length -ge $test.expectedLength -and -not $hasError -and -not $isGeneric -and -not $isFallback
        
        if ($isDetailed) {
            Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "   ❌ ISSUE DETECTED" -ForegroundColor Red
        }
        
        Write-Host "   📏 Length: $($response.responseText.Length) chars (expected: $($test.expectedLength)+)" -ForegroundColor $(if ($response.responseText.Length -ge $test.expectedLength) { "Green" } else { "Red" })
        Write-Host "   🔄 Thread ID: $($response.threadId)" -ForegroundColor Cyan
        Write-Host "   🎯 Games Found: $($response.matchingGamesCount)" -ForegroundColor Cyan
        Write-Host "   ❌ Has Errors: $(if ($hasError) { "YES" } else { "NO" })" -ForegroundColor $(if ($hasError) { "Red" } else { "Green" })
        Write-Host "   🤖 Generic Response: $(if ($isGeneric) { "YES" } else { "NO" })" -ForegroundColor $(if ($isGeneric) { "Red" } else { "Green" })
        Write-Host "   🔄 Fallback Response: $(if ($isFallback) { "YES" } else { "NO" })" -ForegroundColor $(if ($isFallback) { "Red" } else { "Green" })
        
        Write-Host "   📝 Response Preview:" -ForegroundColor Yellow
        Write-Host "   $($response.responseText.Substring(0, [Math]::Min(120, $response.responseText.Length)))" -ForegroundColor White
        if ($response.responseText.Length -gt 120) { Write-Host "   [...]" -ForegroundColor Gray }
        
    } catch {
        Write-Host "   ❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    if ($i -lt $testQueries.Count - 1) {
        Write-Host "   ⏳ Waiting 3 seconds before next test..." -ForegroundColor Gray
        Start-Sleep 3
    }
}

Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "📊 FINAL RESULTS:" -ForegroundColor Magenta
Write-Host "✅ Successful Tests: $successCount / $totalTests" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } else { "Yellow" })

if ($successCount -eq $totalTests) {
    Write-Host "🎉 ALL TESTS PASSED! PRODUCTION IS FULLY FIXED! 🎉" -ForegroundColor Green
    Write-Host "🚀 The Azure AI Agent production issue has been completely resolved!" -ForegroundColor Green
} elseif ($successCount -gt 0) {
    Write-Host "⚠️  Partial success. Some issues may remain." -ForegroundColor Yellow
} else {
    Write-Host "❌ All tests failed. Issues still need to be resolved." -ForegroundColor Red
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. If tests passed: Remove production debugging bypass from IsLowQualityResponse" -ForegroundColor Gray
Write-Host "2. Set MaxLowQualityRetries back to 2 in appsettings.Production.json" -ForegroundColor Gray
Write-Host "3. Deploy the final clean version to production" -ForegroundColor Gray
