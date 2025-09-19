# GamerUncle API Functional Tests - PowerShell Script

Write-Host "🎯 GamerUncle API Functional Tests" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Resolve script directory to build robust relative paths regardless of current working directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Determine repo root by climbing until gamer-uncle.sln is found
$Current = Resolve-Path $ScriptDir
while ($Current -and -not (Test-Path (Join-Path $Current "gamer-uncle.sln"))) {
    $Parent = Split-Path $Current -Parent
    if ($Parent -eq $Current) { break }
    $Current = $Parent
}
if (Test-Path (Join-Path $Current "gamer-uncle.sln")) {
    $RepoRoot = $Current
} else {
    # fallback: assume script path depth and go up four levels
    $RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..\..\..")
}
Push-Location $RepoRoot
$ApiProject = Join-Path $RepoRoot "services\api\GamerUncle.Api.csproj"
Write-Host "ℹ ScriptDir: $ScriptDir" -ForegroundColor DarkGray
Write-Host "ℹ RepoRoot:  $RepoRoot" -ForegroundColor DarkGray
Write-Host "ℹ CurrentDir: $(Get-Location)" -ForegroundColor DarkGray
Write-Host "ℹ ApiProject: $ApiProject" -ForegroundColor DarkGray

if (-not (Test-Path $ApiProject)) {
    Write-Host "❌ API project not found at $ApiProject (resolved from $ScriptDir)" -ForegroundColor Red
    exit 1
}

try {
    # Set environment for API to bypass rate limiting
    $env:ASPNETCORE_ENVIRONMENT = "Testing"
    $env:Testing__DisableRateLimit = "true"

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
    $env:ASPNETCORE_ENVIRONMENT = "Testing"
    $env:Testing__DisableRateLimit = "true"

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
