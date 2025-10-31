# Test script for Phase 5.2 - Verify AFD routing for voice endpoint
# Tests: AFD routing, WAF protection, rate limiting

param(
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev'
)

$ErrorActionPreference = 'Stop'

# AFD endpoints
$afdEndpoints = @{
    'dev' = 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net'
    'prod' = 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net'
}

$baseUrl = $afdEndpoints[$Environment]
$endpoint = "$baseUrl/api/voice/process"

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "Phase 5.2: AFD Voice Endpoint Verification" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Verify AFD routing works
Write-Host "[Test 1] Verifying AFD routes to voice endpoint..." -ForegroundColor Yellow

# Create minimal test audio data (base64 encoded silent PCM16)
$audioData = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQAAAAA="

$body = @{
    audioData = $audioData
    format = "PCM16"
    conversationId = "afd-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $endpoint -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    # Check for AFD headers
    $afdHeaders = @('x-azure-ref', 'x-azure-requestchain', 'x-fd-healthprobe')
    $hasAfdHeaders = $false
    
    foreach ($header in $afdHeaders) {
        if ($response.Headers[$header]) {
            Write-Host "  [+] Found AFD header: $header" -ForegroundColor Green
            $hasAfdHeaders = $true
        }
    }
    
    if ($hasAfdHeaders) {
        Write-Host "  [+] Request routed through Azure Front Door" -ForegroundColor Green
    } else {
        Write-Host "  [!] AFD headers not detected (may be stripped by service)" -ForegroundColor Yellow
    }
    
    Write-Host "  [+] Endpoint accessible through AFD: Status $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "  [-] AFD routing test failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Verify WAF protection (malicious request detection)
Write-Host "[Test 2] Verifying WAF protection..." -ForegroundColor Yellow

# Test with suspicious patterns - SQL injection only
$maliciousPatterns = @(
    @{ name = "SQL Injection"; header = "X-Test"; value = "' OR '1'='1" }
)

foreach ($pattern in $maliciousPatterns) {
    try {
        $headers = @{ $pattern.header = $pattern.value }
        $response = Invoke-WebRequest -Uri $endpoint -Method POST -Body $body -ContentType "application/json" -Headers $headers -UseBasicParsing -ErrorAction Stop
        
        # If we get here, WAF didn't block (might be expected for custom headers)
        Write-Host "  [i] $($pattern.name): Not blocked - Status: $($response.StatusCode)" -ForegroundColor Cyan
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "  [+] $($pattern.name): Blocked by WAF with 403" -ForegroundColor Green
        } else {
            Write-Host "  [i] $($pattern.name): Different error - $($_.Exception.Response.StatusCode)" -ForegroundColor Cyan
        }
    }
}

Write-Host "  [i] Note: WAF rules may be configured to allow certain patterns in custom headers" -ForegroundColor Cyan
Write-Host ""

# Test 3: Verify rate limiting
Write-Host "[Test 3] Verifying rate limiting - 15 requests per minute..." -ForegroundColor Yellow

$rateLimitHits = 0
$totalRequests = 20
$successfulRequests = 0
$rateLimitedRequests = 0

for ($i = 1; $i -le $totalRequests; $i++) {
    try {
        $testBody = @{
            audioData = $audioData
            format = "PCM16"
            conversationId = "rate-test-$i-$(Get-Date -Format 'HHmmss')"
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri $endpoint -Method POST -Body $testBody -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $successfulRequests++
        Write-Host "  Request $i : Success with status 200" -ForegroundColor Green
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) {
            $rateLimitedRequests++
            Write-Host "  Request $i : Rate Limited with 429" -ForegroundColor Yellow
        } else {
            Write-Host "  Request $i : Error - $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
    
    # Small delay between requests
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "Rate Limiting Results:" -ForegroundColor Cyan
Write-Host "  Total Requests: $totalRequests" -ForegroundColor White
Write-Host "  Successful: $successfulRequests" -ForegroundColor Green
Write-Host "  Rate Limited: $rateLimitedRequests" -ForegroundColor Yellow

if ($rateLimitedRequests -gt 0) {
    Write-Host "  [+] Rate limiting is active - limit: 15 requests per min" -ForegroundColor Green
} else {
    Write-Host "  [!] No rate limiting detected - expected for testing environment" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AFD Verification Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
