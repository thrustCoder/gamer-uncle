#!/usr/bin/env pwsh

Write-Host "🔧 Production Agent Configuration Fix Guide" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "`n📋 Issue Confirmed:" -ForegroundColor Yellow
Write-Host "  ❌ PROD Agent returns generic placeholders: 'On it! Give me a moment...'" -ForegroundColor Red
Write-Host "  ✅ DEV Agent returns detailed responses about games" -ForegroundColor Green

Write-Host "`n🎯 Agent Information:" -ForegroundColor Yellow
Write-Host "  DEV Agent ID:  asst_I9OYA4pzbMEmjzz84Vo5z4Zm" -ForegroundColor Green
Write-Host "  PROD Agent ID: asst_vzwvCm0X0cfZmGWUENbFXseg" -ForegroundColor Red

Write-Host "`n🌐 AI Foundry Portal URLs:" -ForegroundColor Yellow
Write-Host "  DEV:  https://gamer-uncle-dev-foundry.services.ai.azure.com/" -ForegroundColor Green
Write-Host "  PROD: https://gamer-uncle-prod-foundry-resourc.services.ai.azure.com/" -ForegroundColor Red

Write-Host "`n🛠️ Manual Fix Steps:" -ForegroundColor Green
Write-Host "1. Open Azure AI Foundry portal for PRODUCTION:" -ForegroundColor Gray
Write-Host "   https://gamer-uncle-prod-foundry-resourc.services.ai.azure.com/" -ForegroundColor White
Write-Host "`n2. Navigate to agent asst_vzwvCm0X0cfZmGWUENbFXseg" -ForegroundColor Gray
Write-Host "`n3. Compare system prompts with DEV agent:" -ForegroundColor Gray
Write-Host "   - Check Instructions/System Message" -ForegroundColor Gray
Write-Host "   - Verify model deployment is set to 'gpt-4.1'" -ForegroundColor Gray
Write-Host "   - Ensure no generic response templates are configured" -ForegroundColor Gray
Write-Host "`n4. Update PROD agent to match DEV configuration" -ForegroundColor Gray

Write-Host "`n🧪 Test Commands:" -ForegroundColor Green
Write-Host "After fixing the agent configuration, test with:" -ForegroundColor Gray
Write-Host '$testQuery = @{ query = "What is Catan about?"; userId = "test" } | ConvertTo-Json' -ForegroundColor White
Write-Host '$response = Invoke-RestMethod -Uri "https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/Recommendations" -Method Post -Body $testQuery -ContentType "application/json"' -ForegroundColor White
Write-Host 'Write-Host $response.responseText' -ForegroundColor White

Write-Host "`n⚠️  Important:" -ForegroundColor Yellow
Write-Host "Once agent is fixed, remove the production bypass:" -ForegroundColor Gray
Write-Host "- Remove ASPNETCORE_ENVIRONMENT check in IsLowQualityResponse method" -ForegroundColor Gray
Write-Host "- Set MaxLowQualityRetries back to 2 in appsettings.Production.json" -ForegroundColor Gray
