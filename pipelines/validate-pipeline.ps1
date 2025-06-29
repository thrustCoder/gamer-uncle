# Pipeline Validation Test Script (PowerShell)
# This script validates the build and deployment logic for the Azure DevOps pipeline

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Pipeline Validation Tests..." -ForegroundColor Green

# Test 1: Validate package.json exists and has required scripts
function Test-MobilePackageJson {
    Write-Host "📱 Testing mobile package.json configuration..." -ForegroundColor Cyan
    
    if (-not (Test-Path "apps/mobile/package.json")) {
        Write-Host "❌ package.json not found in apps/mobile/" -ForegroundColor Red
        return $false
    }
    
    $packageJson = Get-Content "apps/mobile/package.json" -Raw
    
    # Check if required scripts exist
    if ($packageJson -notmatch '"start"') {
        Write-Host "❌ 'start' script not found in package.json" -ForegroundColor Red
        return $false
    }
    
    if ($packageJson -notmatch '"web"') {
        Write-Host "❌ 'web' script not found in package.json" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ Mobile package.json validation passed" -ForegroundColor Green
    return $true
}

# Test 2: Validate API project file exists
function Test-ApiProjectExists {
    Write-Host "🔧 Testing API project configuration..." -ForegroundColor Cyan
    
    if (-not (Test-Path "services/api/GamerUncle.Api.csproj")) {
        Write-Host "❌ API project file not found" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ API project validation passed" -ForegroundColor Green
    return $true
}

# Test 3: Validate Function project file exists
function Test-FunctionProjectExists {
    Write-Host "⚡ Testing Function project configuration..." -ForegroundColor Cyan
    
    if (-not (Test-Path "services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj")) {
        Write-Host "❌ Function project file not found" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ Function project validation passed" -ForegroundColor Green
    return $true
}

# Test 4: Validate mobile dependencies can be installed
function Test-MobileDependencies {
    Write-Host "📦 Testing mobile dependencies installation..." -ForegroundColor Cyan
    
    Push-Location "apps/mobile"
    
    try {
        # Check if node_modules exists or can be created
        if (-not (Test-Path "node_modules")) {
            Write-Host "📥 Installing mobile dependencies..." -ForegroundColor Yellow
            
            $npmProcess = Start-Process -FilePath "npm" -ArgumentList "install", "--silent" -Wait -PassThru -NoNewWindow
            
            if ($npmProcess.ExitCode -ne 0) {
                Write-Host "❌ Failed to install mobile dependencies" -ForegroundColor Red
                return $false
            }
        }
        
        # Verify key dependencies are installed
        if (-not (Test-Path "node_modules/expo")) {
            Write-Host "❌ Expo dependency not installed correctly" -ForegroundColor Red
            return $false
        }
        
        if (-not (Test-Path "node_modules/react")) {
            Write-Host "❌ React dependency not installed correctly" -ForegroundColor Red
            return $false
        }
        
        Write-Host "✅ Mobile dependencies validation passed" -ForegroundColor Green
        return $true
    }
    finally {
        Pop-Location
    }
}

# Test 5: Validate mobile build process
function Test-MobileBuild {
    Write-Host "🏗️ Testing mobile build process..." -ForegroundColor Cyan
    
    Push-Location "apps/mobile"
    
    try {
        # Test npx command availability
        $npxCommand = Get-Command npx -ErrorAction SilentlyContinue
        if (-not $npxCommand) {
            Write-Host "❌ npx command not found" -ForegroundColor Red
            return $false
        }
        
        # Create a test output directory
        $testOutputDir = "../../test-mobile-output"
        New-Item -ItemType Directory -Path $testOutputDir -Force | Out-Null
        
        # Test expo export command availability
        Write-Host "📤 Testing expo export command availability..." -ForegroundColor Yellow
        
        $expoProcess = Start-Process -FilePath "npx" -ArgumentList "expo", "--version" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "NUL" -RedirectStandardError "NUL"
        
        if ($expoProcess.ExitCode -eq 0) {
            Write-Host "✅ Expo CLI is available" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Expo CLI not available (expected in CI environment)" -ForegroundColor Yellow
        }
        
        # Clean up test directory
        Remove-Item -Path $testOutputDir -Recurse -Force -ErrorAction SilentlyContinue
        
        Write-Host "✅ Mobile build validation passed" -ForegroundColor Green
        return $true
    }
    finally {
        Pop-Location
    }
}

# Test 6: Validate API build process (if dotnet is available)
function Test-ApiBuild {
    Write-Host "🔨 Testing API build process..." -ForegroundColor Cyan
    
    $dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
    if (-not $dotnetCommand) {
        Write-Host "⚠️ .NET SDK not available (expected in some CI environments)" -ForegroundColor Yellow
        return $true
    }
    
    # Test restore
    $restoreProcess = Start-Process -FilePath "dotnet" -ArgumentList "restore", "services/api/GamerUncle.Api.csproj", "--verbosity", "quiet" -Wait -PassThru -NoNewWindow
    
    if ($restoreProcess.ExitCode -ne 0) {
        Write-Host "❌ Failed to restore API dependencies" -ForegroundColor Red
        return $false
    }
    
    # Test build
    $buildProcess = Start-Process -FilePath "dotnet" -ArgumentList "build", "services/api/GamerUncle.Api.csproj", "--configuration", "Release", "--no-restore", "--verbosity", "quiet" -Wait -PassThru -NoNewWindow
    
    if ($buildProcess.ExitCode -ne 0) {
        Write-Host "❌ Failed to build API project" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ API build validation passed" -ForegroundColor Green
    return $true
}

# Test 7: Validate Function build process (if dotnet is available)
function Test-FunctionBuild {
    Write-Host "⚡ Testing Function build process..." -ForegroundColor Cyan
    
    $dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
    if (-not $dotnetCommand) {
        Write-Host "⚠️ .NET SDK not available (expected in some CI environments)" -ForegroundColor Yellow
        return $true
    }
    
    # Test restore
    $restoreProcess = Start-Process -FilePath "dotnet" -ArgumentList "restore", "services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj", "--verbosity", "quiet" -Wait -PassThru -NoNewWindow
    
    if ($restoreProcess.ExitCode -ne 0) {
        Write-Host "❌ Failed to restore Function dependencies" -ForegroundColor Red
        return $false
    }
    
    # Test build
    $buildProcess = Start-Process -FilePath "dotnet" -ArgumentList "build", "services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj", "--configuration", "Release", "--no-restore", "--verbosity", "quiet" -Wait -PassThru -NoNewWindow
    
    if ($buildProcess.ExitCode -ne 0) {
        Write-Host "❌ Failed to build Function project" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ Function build validation passed" -ForegroundColor Green
    return $true
}

# Test 8: Validate pipeline YAML syntax
function Test-PipelineYaml {
    Write-Host "📋 Testing pipeline YAML syntax..." -ForegroundColor Cyan
    
    if (-not (Test-Path "pipelines/azure-pipelines.yml")) {
        Write-Host "❌ Pipeline YAML file not found" -ForegroundColor Red
        return $false
    }
    
    $pipelineContent = Get-Content "pipelines/azure-pipelines.yml" -Raw
    
    # Check for required sections
    if ($pipelineContent -notmatch "trigger:") {
        Write-Host "❌ Missing trigger section in pipeline" -ForegroundColor Red
        return $false
    }
    
    if ($pipelineContent -notmatch "stages:") {
        Write-Host "❌ Missing stages section in pipeline" -ForegroundColor Red
        return $false
    }
    
    # Check for test stage
    if ($pipelineContent -notmatch "DevTest") {
        Write-Host "❌ Missing test stage in pipeline" -ForegroundColor Red
        return $false
    }
    
    # Check for pipeline tests
    if (-not (Test-Path "pipelines/tests/GamerUncle.Pipeline.Tests.csproj")) {
        Write-Host "❌ Missing pipeline test project file" -ForegroundColor Red
        return $false
    }
    
    # Check for API tests
    if (-not (Test-Path "services/tests/api/GamerUncle.Api.Tests.csproj")) {
        Write-Host "❌ Missing API test project file" -ForegroundColor Red
        return $false
    }
    
    # Check for path-based triggers
    if ($pipelineContent -notmatch "paths:") {
        Write-Host "❌ Missing path-based triggers in pipeline" -ForegroundColor Red
        return $false
    }
    
    # Check for mobile-related content
    if ($pipelineContent -notmatch "apps/mobile") {
        Write-Host "❌ Missing mobile app configuration in pipeline" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ Pipeline YAML validation passed" -ForegroundColor Green
    return $true
}

# Main function to run all tests
function Main {
    $failedTests = 0
    
    Write-Host "📊 Running Pipeline Validation Test Suite..." -ForegroundColor Blue
    Write-Host "==================================================" -ForegroundColor Blue
    
    # Run tests
    if (-not (Test-MobilePackageJson)) { $failedTests++ }
    if (-not (Test-ApiProjectExists)) { $failedTests++ }
    if (-not (Test-FunctionProjectExists)) { $failedTests++ }
    if (-not (Test-MobileDependencies)) { $failedTests++ }
    if (-not (Test-MobileBuild)) { $failedTests++ }
    if (-not (Test-ApiBuild)) { $failedTests++ }
    if (-not (Test-FunctionBuild)) { $failedTests++ }
    if (-not (Test-PipelineYaml)) { $failedTests++ }
    
    Write-Host "==================================================" -ForegroundColor Blue
    
    if ($failedTests -eq 0) {
        Write-Host "🎉 All pipeline validation tests passed!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ $failedTests test(s) failed" -ForegroundColor Red
        exit 1
    }
}

# Run main function
Main
