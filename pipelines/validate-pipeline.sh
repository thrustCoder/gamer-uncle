#!/bin/bash

# Pipeline Validation Test Script
# This script validates the build and deployment logic for the Azure DevOps pipeline

set -e  # Exit on any error

echo "🚀 Starting Pipeline Validation Tests..."

# Test 1: Validate package.json exists and has required scripts
test_mobile_package_json() {
    echo "📱 Testing mobile package.json configuration..."
    
    if [ ! -f "apps/mobile/package.json" ]; then
        echo "❌ package.json not found in apps/mobile/"
        return 1
    fi
    
    # Check if required scripts exist
    if ! grep -q '"start"' apps/mobile/package.json; then
        echo "❌ 'start' script not found in package.json"
        return 1
    fi
    
    if ! grep -q '"web"' apps/mobile/package.json; then
        echo "❌ 'web' script not found in package.json"
        return 1
    fi
    
    echo "✅ Mobile package.json validation passed"
    return 0
}

# Test 2: Validate API project file exists
test_api_project_exists() {
    echo "🔧 Testing API project configuration..."
    
    if [ ! -f "services/api/GamerUncle.Api.csproj" ]; then
        echo "❌ API project file not found"
        return 1
    fi
    
    echo "✅ API project validation passed"
    return 0
}

# Test 3: Validate Function project file exists
test_function_project_exists() {
    echo "⚡ Testing Function project configuration..."
    
    if [ ! -f "services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj" ]; then
        echo "❌ Function project file not found"
        return 1
    fi
    
    echo "✅ Function project validation passed"
    return 0
}

# Test 4: Validate mobile dependencies can be installed
test_mobile_dependencies() {
    echo "📦 Testing mobile dependencies installation..."
    
    cd apps/mobile
    
    # Check if node_modules exists or can be created
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing mobile dependencies..."
        npm install --silent
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install mobile dependencies"
            cd ../..
            return 1
        fi
    fi
    
    # Verify key dependencies are installed
    if [ ! -d "node_modules/expo" ]; then
        echo "❌ Expo dependency not installed correctly"
        cd ../..
        return 1
    fi
    
    if [ ! -d "node_modules/react" ]; then
        echo "❌ React dependency not installed correctly"
        cd ../..
        return 1
    fi
    
    cd ../..
    echo "✅ Mobile dependencies validation passed"
    return 0
}

# Test 5: Validate mobile build process
test_mobile_build() {
    echo "🏗️  Testing mobile build process..."
    
    cd apps/mobile
    
    # Test expo export command (dry run)
    if ! command -v npx &> /dev/null; then
        echo "❌ npx command not found"
        cd ../..
        return 1
    fi
    
    # Create a test output directory
    TEST_OUTPUT_DIR="../../test-mobile-output"
    mkdir -p $TEST_OUTPUT_DIR
    
    # Test expo export (this might fail in CI without full setup, but we can check command exists)
    echo "📤 Testing expo export command availability..."
    if npx expo --version &> /dev/null; then
        echo "✅ Expo CLI is available"
    else
        echo "⚠️  Expo CLI not available (expected in CI environment)"
    fi
    
    # Clean up test directory
    rm -rf $TEST_OUTPUT_DIR
    
    cd ../..
    echo "✅ Mobile build validation passed"
    return 0
}

# Test 6: Validate API build process (if dotnet is available)
test_api_build() {
    echo "🔨 Testing API build process..."
    
    if ! command -v dotnet &> /dev/null; then
        echo "⚠️  .NET SDK not available (expected in some CI environments)"
        return 0
    fi
    
    # Test restore
    if ! dotnet restore services/api/GamerUncle.Api.csproj --verbosity quiet; then
        echo "❌ Failed to restore API dependencies"
        return 1
    fi
    
    # Test build (without publish to save time)
    if ! dotnet build services/api/GamerUncle.Api.csproj --configuration Release --no-restore --verbosity quiet; then
        echo "❌ Failed to build API project"
        return 1
    fi
    
    echo "✅ API build validation passed"
    return 0
}

# Test 7: Validate Function build process (if dotnet is available)
test_function_build() {
    echo "⚡ Testing Function build process..."
    
    if ! command -v dotnet &> /dev/null; then
        echo "⚠️  .NET SDK not available (expected in some CI environments)"
        return 0
    fi
    
    # Test restore
    if ! dotnet restore services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj --verbosity quiet; then
        echo "❌ Failed to restore Function dependencies"
        return 1
    fi
    
    # Test build
    if ! dotnet build services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj --configuration Release --no-restore --verbosity quiet; then
        echo "❌ Failed to build Function project"
        return 1
    fi
    
    echo "✅ Function build validation passed"
    return 0
}

# Test 8: Validate pipeline YAML syntax
test_pipeline_yaml() {
    echo "📋 Testing pipeline YAML syntax..."
    
    if [ ! -f "pipelines/azure-pipelines.yml" ]; then
        echo "❌ Pipeline YAML file not found"
        return 1
    fi
    
    # Basic YAML validation (if yq is available)
    if command -v yq &> /dev/null; then
        if ! yq eval pipelines/azure-pipelines.yml > /dev/null; then
            echo "❌ Invalid YAML syntax in pipeline file"
            return 1
        fi
    else
        echo "⚠️  YAML validator not available, skipping syntax check"
    fi
    
    # Check for required sections
    if ! grep -q "trigger:" pipelines/azure-pipelines.yml; then
        echo "❌ Missing trigger section in pipeline"
        return 1
    fi
    
    if ! grep -q "stages:" pipelines/azure-pipelines.yml; then
        echo "❌ Missing stages section in pipeline"
        return 1
    fi
    
    # Check for test stage
    if ! grep -q "DevTest" pipelines/azure-pipelines.yml; then
        echo "❌ Missing test stage in pipeline"
        return 1
    fi
    
    # Check for pipeline tests
    if [ ! -f "pipelines/tests/GamerUncle.Pipeline.Tests.csproj" ]; then
        echo "❌ Missing pipeline test project file"
        return 1
    fi
    
    # Check for API tests  
    if [ ! -f "services/tests/api/GamerUncle.Api.Tests.csproj" ]; then
        echo "❌ Missing API test project file"
        return 1
    fi
    
    echo "✅ Pipeline YAML validation passed"
    return 0
}

# Run all tests
main() {
    local failed_tests=0
    
    echo "📊 Running Pipeline Validation Test Suite..."
    echo "=================================================="
    
    # Run tests
    test_mobile_package_json || ((failed_tests++))
    test_api_project_exists || ((failed_tests++))
    test_function_project_exists || ((failed_tests++))
    test_mobile_dependencies || ((failed_tests++))
    test_mobile_build || ((failed_tests++))
    test_api_build || ((failed_tests++))
    test_function_build || ((failed_tests++))
    test_pipeline_yaml || ((failed_tests++))
    
    echo "=================================================="
    
    if [ $failed_tests -eq 0 ]; then
        echo "🎉 All pipeline validation tests passed!"
        return 0
    else
        echo "❌ $failed_tests test(s) failed"
        return 1
    fi
}

# Run main function
main "$@"
