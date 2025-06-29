# Pipeline Configuration and Testing

This document describes the Azure DevOps pipeline configuration for the Gamer Uncle project, including build, test, and deployment processes for the API, Function Apps, and Mobile application.

## Pipeline Structure

The pipeline is configured with path-based triggers to only run relevant builds when specific parts of the codebase change:

### Triggers

- **API Builds**: Triggered when changes are made to `services/api/*`
- **Function Builds**: Triggered when changes are made to `services/functions/*`  
- **Mobile Builds**: Triggered when changes are made to `apps/mobile/*`
- **Pipeline Tests**: Triggered when changes are made to `pipelines/*`

### Build Jobs

#### API Build Job (`BuildApiJob`)
- Restores .NET dependencies
- Builds the GamerUncle.Api project
- Publishes artifacts to `dropApi`
- Only runs when API-related files change

#### Function Build Job (`BuildFunctionJob`)
- Restores .NET dependencies for Azure Functions
- Builds the GamerUncle.Function.BggSync project
- Publishes artifacts to `dropFunction`
- Only runs when Function-related files change

#### Mobile Build Job (`BuildMobileJob`)
- Installs Node.js dependencies
- Builds React Native/Expo mobile app
- Exports web build using Expo CLI
- Creates archived mobile artifacts in `dropMobile`
- Only runs when mobile app files change

### Test Jobs

#### API Test Job (`TestApiJob`)
- Runs unit tests for API components
- Located in `services/tests/api/`
- Publishes test results to Azure DevOps
- Fails pipeline if tests fail

#### Pipeline Test Job (`TestPipelineJob`)
- Runs validation tests for pipeline configuration
- Located in `pipelines/tests/`
- Validates project structure and configuration files
- Ensures pipeline integrity

#### Mobile Test Job (`TestMobileJob`)
- Runs mobile app tests (if configured)
- Validates mobile dependencies and configuration
- Uses npm test script

### Deployment Stages

#### API Deployment (`DevDeployApi`)
- Deploys API to Azure App Service
- Configures app settings for Cosmos DB integration
- Only runs for non-PR builds when API changes are detected
- Depends on successful build and test completion

#### Function Deployment (`DevDeployFunctions`)
- Deploys Azure Functions to Function App
- Configures function app settings
- Triggers the GameSyncHttpStart function after deployment
- Only runs for non-PR builds when Function changes are detected
- Depends on successful build and test completion

#### Mobile Deployment (`DevDeployMobile`)
- Extracts mobile build artifacts
- Prepared for deployment to static hosting service
- Only runs for non-PR builds when mobile changes are detected
- Depends on successful build and test completion

## Testing and Validation

### Automated Testing Scripts

The pipeline includes comprehensive validation scripts to ensure build integrity:

#### PowerShell Validation (`validate-pipeline.ps1`)
- Validates mobile package.json configuration
- Checks API and Function project files
- Tests dependency installation
- Verifies build processes
- Validates pipeline YAML syntax

#### Bash Validation (`validate-pipeline.sh`)
- Cross-platform validation script
- Same test coverage as PowerShell version
- Suitable for Linux/macOS environments

#### Unit Tests (`PipelineBuildTests.cs`)
- C# unit tests using xUnit framework
- Validates project structure and configuration files
- Tests pipeline YAML contains required sections
- Verifies path-based triggers are properly configured

### Running Tests Locally

#### Using VS Code Tasks
The project includes several VS Code tasks for local testing:

```bash
# Run PowerShell validation
Ctrl+Shift+P -> "Tasks: Run Task" -> "validate-pipeline-powershell"

# Run Bash validation  
Ctrl+Shift+P -> "Tasks: Run Task" -> "validate-pipeline-bash"

# Run unit tests
Ctrl+Shift+P -> "Tasks: Run Task" -> "test-pipeline-unit-tests"

# Build mobile app locally
Ctrl+Shift+P -> "Tasks: Run Task" -> "build-mobile-local"

# Export mobile web build
Ctrl+Shift+P -> "Tasks: Run Task" -> "export-mobile-web"
```

#### Using Command Line

**PowerShell:**
```powershell
./pipelines/validate-pipeline.ps1
```

**Bash:**
```bash
./pipelines/validate-pipeline.sh
```

**Unit Tests:**
```bash
dotnet test services/tests/GamerUncle.Pipeline.Tests.csproj
```

**Mobile Build:**
```bash
cd apps/mobile
npm install
npx expo export --platform web --output-dir ../../dist/mobile-web
```

## Configuration Files

### Key Files

- `pipelines/azure-pipelines.yml` - Main Azure DevOps pipeline configuration
- `apps/mobile/package.json` - Mobile app dependencies and scripts
- `apps/mobile/app.json` - Expo configuration
- `services/api/GamerUncle.Api.csproj` - API project configuration
- `services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj` - Function project configuration

### Testing Files

- `pipelines/tests/PipelineBuildTests.cs` - C# pipeline validation tests
- `pipelines/tests/GamerUncle.Pipeline.Tests.csproj` - Pipeline test project configuration
- `services/tests/api/AgentServiceClientTests.cs` - API service tests
- `services/tests/api/GamerUncle.Api.Tests.csproj` - API test project configuration
- `pipelines/validate-pipeline.ps1` - PowerShell validation script
- `pipelines/validate-pipeline.sh` - Bash validation script  
- `.vscode/tasks-pipeline.json` - VS Code task definitions

## Pipeline Variables

The pipeline uses the following key variables:

- `buildConfiguration`: Set to 'Release'
- `apiProject`: Path to API project file
- `functionAppProject`: Path to Function project file
- `mobileProject`: Path to mobile app directory
- `publishOutputApiProject`: API publish output directory
- `publishOutputFunctionProject`: Function publish output directory
- `publishOutputMobileProject`: Mobile publish output directory

## Troubleshooting

### Common Issues

1. **Mobile build fails**: Ensure Node.js dependencies are properly installed
2. **API/Function build fails**: Check .NET SDK version compatibility
3. **Path triggers not working**: Verify file paths in git commits match trigger patterns
4. **Deployment failures**: Check Azure service connection and resource names

### Debugging Steps

1. Run validation scripts locally to identify configuration issues
2. Check pipeline logs for specific error messages
3. Verify all required files exist in expected locations
4. Test build processes locally before committing changes

## Future Enhancements

- Add automated testing for mobile app builds
- Implement staging deployment slots
- Add performance testing to pipeline
- Configure automated rollback on deployment failures
- Add notifications for build/deployment status
