# GamerUncle API Functional Tests - PowerShell Script

Write-Host "🎯 GamerUncle API Functional Tests" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Check if API project exists
$ApiProject = "..\..\api\GamerUncle.Api.csproj"
if (-not (Test-Path $ApiProject)) {
    Write-Host "❌ API project not found at $ApiProject" -ForegroundColor Red
    exit 1
}

try {
    # Start API in background
    Write-Host "🚀 Starting API server..." -ForegroundColor Green
    $ApiProcess = Start-Process -FilePath "dotnet" -ArgumentList "run", "--project", $ApiProject -PassThru -WindowStyle Hidden

    # Wait for API to start
    Write-Host "⏳ Waiting for API to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15

    # Test if API is responding
    $ApiResponding = $false
    for ($i = 1; $i -le 12; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5000/" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404) {
                Write-Host "✅ API is responding" -ForegroundColor Green
                $ApiResponding = $true
                break
            }
        }
        catch {
            # Try alternative endpoint
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:5000/api/recommendations" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
                Write-Host "✅ API is responding" -ForegroundColor Green
                $ApiResponding = $true
                break
            }
            catch {
                # Continue waiting
            }
        }
        Write-Host "⏳ Waiting for API... attempt $i/12" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }

    if (-not $ApiResponding) {
        Write-Host "❌ API failed to start or is not responding" -ForegroundColor Red
        throw "API not responding"
    }

    # Set test environment
    $env:TEST_ENVIRONMENT = "Local"
    $env:API_BASE_URL = "http://localhost:5000"

    # Run functional tests
    Write-Host "🧪 Running functional tests..." -ForegroundColor Green
    & dotnet test --logger "console;verbosity=normal"
    $testExitCode = $LASTEXITCODE

    if ($testExitCode -eq 0) {
        Write-Host "✅ All functional tests passed!" -ForegroundColor Green
    } else {
        Write-Host "❌ Some functional tests failed!" -ForegroundColor Red
    }

    exit $testExitCode
}
finally {
    # Cleanup
    Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow
    if ($ApiProcess -and -not $ApiProcess.HasExited) {
        Stop-Process -Id $ApiProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
}
