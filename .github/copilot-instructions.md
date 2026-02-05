# Gamer Uncle AI Coding Instructions

## Architecture Overview

This is a **React Native (Expo) + .NET 8 API + Azure AI** board game assistant app with three main components:

- **Mobile App** (`apps/mobile/`): React Native Expo app with TypeScript
- **API Service** (`services/api/`): .NET 8 Web API with Azure AI Agent integration
- **Azure Functions** (`services/functions/`): BGG data sync using Durable Functions
- **Shared Models** (`services/shared/models/`): Common data structures across services

## Critical Development Patterns

### Configuration Management
- **Environment-specific appsettings**: Use `appsettings.{Environment}.json` for env-specific configs
- **Testing configs**: `appsettings.Testing.json` disables rate limiting for functional tests
- **Azure resources**: All services use `DefaultAzureCredential` for managed identity auth
- **Key settings**: `AgentService.Endpoint`, `CosmosDb.Endpoint`, rate limiting configs

### Secrets Management (CRITICAL)
- **NEVER commit secrets to code**: No API keys, connection strings, or passwords in appsettings files
- **Local development**: Use `dotnet user-secrets` for sensitive configuration
- **Azure deployment**: Use Key Vault references in appsettings: `@Microsoft.KeyVault(SecretUri=...)`
- **User secrets location**: `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json` (outside repo)

**Setting up local secrets:**
```powershell
# Initialize user secrets (already done for this project)
dotnet user-secrets init --project services/api/GamerUncle.Api.csproj

# Set a secret
dotnet user-secrets set "CriteriaCache:RedisConnectionString" "your-connection-string" --project services/api/GamerUncle.Api.csproj

# List all secrets
dotnet user-secrets list --project services/api/GamerUncle.Api.csproj

# Remove a secret
dotnet user-secrets remove "KeyName" --project services/api/GamerUncle.Api.csproj
```

**Current secrets needed for local development:**
- `CriteriaCache:RedisConnectionString` - Upstash Redis connection string for L2 cache

### Rate Limiting Strategy
```csharp
// Different limits per environment - see Program.cs
- Testing: 10,000 permits (disabled for tests)
- RateLimitTesting: 1 permit (for rate limit tests)
- Production: 15 permits per minute with 5 queue slots
```

### Testing Architecture
- **Functional Tests** (`services/tests/functional/`): HTTP tests with anti-fallback logic
- **E2E Tests** (`apps/mobile/e2e/`): Playwright tests validating chat responses
- **Pipeline Tests** (`pipelines/tests/`): YAML pipeline validation tests
- **Anti-fallback pattern**: Tests retry once if AI returns generic responses

### Azure AI Integration
- Uses **Azure AI Agent Service** (not OpenAI directly)
- Conversation tracking via `ConversationId` in `UserQuery` model
- Structured responses through agent orchestration
- Error handling with proper HTTP status codes and logging

### Voice Functionality Configuration
- **Azure OpenAI API Key Required**: Voice functionality requires `VoiceService:AzureOpenAIKey` configuration
- **WebSocket Authentication**: React Native cannot send Authorization headers, so API key must be in query parameters
- **Environment Variable**: Set `AZURE_OPENAI_API_KEY` environment variable for local development
- **Configuration File**: Update `appsettings.Development.json` with actual API key (not placeholder)
- **Root Cause of 401 Errors**: Missing or incorrectly configured Azure OpenAI API key for WebSocket authentication

## Essential Commands

### Development Workflow
```bash
# API Development
dotnet build services/api/GamerUncle.Api.csproj
dotnet run --project services/api/

# Mobile Development - IMPORTANT: Always navigate to apps/mobile first!
cd apps/mobile               # REQUIRED: All mobile commands must be run from this directory
npm start                    # Expo dev server
npx expo start              # Alternative Expo start command
npm run ios                  # iOS simulator
npm run test:e2e            # Playwright E2E tests
eas build --platform ios --profile development  # EAS builds

# Testing
npm run test:e2e:dev        # E2E against dev environment
npm run test:e2e:prod       # E2E against production
dotnet test services/tests/functional/  # API functional tests
```

### API Server Management (CRITICAL)
- **ALWAYS start API server in separate PowerShell window**: Use `Start-Process PowerShell` command
- **Never run commands in the same terminal as the API server**: This will interrupt and shut down the server
- **Environment variables must be set in the server window**: Include `$env:AZURE_OPENAI_API_KEY` in the server start command
- **Example correct server start**:
  ```powershell
  Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\rajsin\r\Code\gamer-uncle'; `$env:AZURE_OPENAI_API_KEY='your_key_here'; dotnet run --project services/api/GamerUncle.Api.csproj --urls 'http://localhost:5001'"
  ```

### Critical Directory Navigation
- **Mobile commands**: MUST be run from `/apps/mobile/` directory
- **API commands**: Can be run from project root or `/services/api/`
- **EAS commands**: MUST be run from `/apps/mobile/` directory
- **Expo commands**: MUST be run from `/apps/mobile/` directory

### Terminal Navigation Rules (CRITICAL)
- **ALWAYS navigate to correct directory FIRST**: New PowerShell sessions start at project root
- **Use full path navigation**: `Set-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"` for mobile commands
- **Verify location before running commands**: Use `Get-Location` or `pwd` to confirm directory
- **Mobile app commands template**:
  ```powershell
  Set-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"; npx expo start --clear
  ```
- **API server commands template**:
  ```powershell
  Set-Location "C:\Users\rajsin\r\Code\gamer-uncle"
  dotnet run --project services/api/GamerUncle.Api.csproj --urls 'http://localhost:5001'
  ```

### Testing Environment Setup
```powershell
# Functional tests against local API
$env:TEST_ENVIRONMENT="Local"
$env:API_BASE_URL="http://localhost:5000"

# E2E tests with specific backend
$env:E2E_BASE_URL="https://gamer-uncle-dev-app-svc.azurewebsites.net"
```

## Key File Patterns

### API Controllers
- Single `RecommendationsController` with rate limiting attribute
- Structured error handling with IP/UserAgent logging
- Request/response models in `Models/` directory

### Mobile App Structure
- **Navigation**: Stack-based with `@react-navigation/stack`
- **State Management**: Context API (not Redux)
- **Services**: Axios-based API clients in `services/`
- **E2E**: Page object pattern with retry logic for AI responses

### Shared Models
- `GameDocument.cs`: Cosmos DB entity with BGG data structure
- `UserQuery.cs`: API request model with conversation tracking
- Cross-project references via `ProjectReference`

## Azure Pipeline Integration

### Multi-stage Pipeline
1. **Validation**: Project structure checks (PR only)
2. **DevBuild**: Parallel mobile/API builds with dependency management
3. **DevDeploy**: Azure App Service deployment with health checks
4. **E2E Validation**: Post-deployment functional tests

### Critical Pipeline Patterns
- **Mobile build artifacts**: Expo web build outputs
- **API publishing**: Self-contained deployment packages
- **Environment promotion**: Dev → Prod with manual approval gates

## Data Flow Architecture

1. **Mobile App** → HTTP POST → **API Controller**
2. **API** → **Azure AI Agent Service** (conversation-aware)
3. **Agent Service** → **Cosmos DB** (game data lookup)
4. **BGG Sync Function** → **Cosmos DB** (background data updates)

## Testing Anti-Patterns to Avoid

- **Fallback responses**: Tests fail if AI returns generic "Let me help..." responses
- **Short responses**: Validates substantial content (>20 characters for complex queries)
- **Non-deterministic tests**: Uses retry logic with 2-second delays for AI stability
- When dealing with C# or TypeScript code, always generate or modify unit tests for all the methods you implement. Do not add tests for YAML code.

## VS Code Task Integration

Use these predefined tasks via `Ctrl+Shift+P` → "Tasks: Run Task":
- `build-api`: Build the .NET API project
- `setup-https-cert`: Configure local HTTPS certificates
- `run-functional-tests-local`: Run API tests against localhost
- `test-functional-project`: Run functional tests with current env settings

## Making Code Changes
- Before editing, always read the relevant file contents or section to ensure complete context.
- Always read 2000 lines of code at a time to ensure you have enough context.
- If a patch is not applied correctly, attempt to reapply it.
- Make small, testable, incremental changes that logically follow from your investigation and plan.
- For backend changes, ensure you add one class/interface per file.

## Quick Commands

### "testit" Command
When the user says **"testit"**, execute the following steps based on the operating system:

---

#### macOS Instructions

On **macOS**, no local API server is needed. The app connects to Azure-hosted APIs (dev or prod based on `API_ENVIRONMENT` in `apiConfig.ts`).

1. **Kill any existing Metro/Node processes** (Expo bundler) to prevent port conflicts:
   ```zsh
   pkill -f "metro" || true
   pkill -f "expo" || true
   ```

2. **Determine the environment** from `apps/mobile/config/apiConfig.ts`:
   - Read the `API_ENVIRONMENT` value to determine which keys to fetch ('dev' or 'prod')

3. **Create/update `.env.local`** with App Key and Speech API Key fetched from Azure Key Vault:
   ```zsh
   cd /Users/rajarshisingh/r/Code3/gamer-uncle/apps/mobile
   
   # Fetch keys from Azure Key Vault
   DEV_APP_KEY=$(az keyvault secret show --vault-name "gamer-uncle-dev-vault" --name "GameSearchAppKey" --query "value" -o tsv)
   PROD_APP_KEY=$(az keyvault secret show --vault-name "gamer-uncle-prod-vault" --name "GameSearchAppKey" --query "value" -o tsv)
   DEV_SPEECH_KEY=$(az keyvault secret show --vault-name "gamer-uncle-dev-vault" --name "SpeechApiKey" --query "value" -o tsv 2>/dev/null || echo "")
   PROD_SPEECH_KEY=$(az keyvault secret show --vault-name "gamer-uncle-prod-vault" --name "SpeechApiKey" --query "value" -o tsv 2>/dev/null || echo "")
   
   # Write to .env.local
   cat > .env.local << EOF
   # Auto-generated by testit command - DO NOT COMMIT
   EXPO_PUBLIC_DEV_APP_KEY=$DEV_APP_KEY
   EXPO_PUBLIC_PROD_APP_KEY=$PROD_APP_KEY
   EXPO_PUBLIC_LOCAL_APP_KEY=$DEV_APP_KEY
   EXPO_PUBLIC_DEV_SPEECH_KEY=$DEV_SPEECH_KEY
   EXPO_PUBLIC_PROD_SPEECH_KEY=$PROD_SPEECH_KEY
   EOF
   ```

4. **Start the Expo mobile app** with dev-client:
   ```zsh
   cd /Users/rajarshisingh/r/Code3/gamer-uncle/apps/mobile && npx expo start --dev-client
   ```

**Important Notes for macOS "testit"**:
- **No local API server**: macOS uses Azure-hosted APIs (dev/prod), not a local server
- App keys AND Speech API keys are fetched from Azure Key Vault based on environment
- The mobile app reads keys from environment variables via `.env.local` (gitignored)
- Use `--dev-client` flag with Expo for development builds
- Change `API_ENVIRONMENT` in `apps/mobile/config/apiConfig.ts` to switch between 'dev' or 'prod'

---

#### Windows Instructions

On **Windows**, the local API server is started for local development.

1. **Kill any existing dotnet processes** to ensure clean state:
   ```powershell
   Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
   ```

2. **Kill any existing Metro/Node processes** (Expo bundler) to prevent port conflicts:
   ```powershell
   Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like "*metro*" -or $_.CommandLine -like "*expo*"} | Stop-Process -Force -ErrorAction SilentlyContinue
   ```

3. **Create/update `.env.local`** with app keys fetched from Azure Key Vault:
   ```powershell
   $devKey = az keyvault secret show --vault-name "gamer-uncle-dev-vault" --name "GameSearchAppKey" --query "value" -o tsv
   $prodKey = az keyvault secret show --vault-name "gamer-uncle-prod-vault" --name "GameSearchAppKey" --query "value" -o tsv
   $envContent = @"
   # Auto-generated by testit command - DO NOT COMMIT
   EXPO_PUBLIC_DEV_APP_KEY=$devKey
   EXPO_PUBLIC_PROD_APP_KEY=$prodKey
   EXPO_PUBLIC_LOCAL_APP_KEY=$devKey
   "@
   Set-Content -Path "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile\.env.local" -Value $envContent
   ```

4. **Start the API server in a new terminal window** (background process):
   - **CRITICAL**: Use `http://*:5001` to bind to all network interfaces (not just localhost) so the mobile device can connect
   ```powershell
   Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\rajsin\r\Code\gamer-uncle'; dotnet run --project services/api/GamerUncle.Api.csproj --urls 'http://*:5001'"
   ```

5. **Start the Expo mobile app** in the current terminal:
   ```powershell
   Push-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"; npx expo start --clear; Pop-Location
   ```

**Important Notes for Windows "testit"**:
- The API server MUST run in a separate PowerShell window to avoid blocking
- App keys are fetched from Azure Key Vault and written to `.env.local` (gitignored)
- The mobile app reads keys from environment variables via `.env.local`
- Use `--clear` flag with Expo to ensure a fresh cache start
- Existing dotnet and Metro/Node processes are killed to prevent port conflicts
- Change `API_ENVIRONMENT` in `apps/mobile/config/apiConfig.ts` to switch between 'local', 'dev', or 'prod'

## General Guidelines

Please don't add any summary documents or markdown files unless asked.