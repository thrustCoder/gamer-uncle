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

## Essential Commands

### Development Workflow
```bash
# API Development
dotnet build services/api/GamerUncle.Api.csproj
dotnet run --project services/api/

# Mobile Development  
cd apps/mobile
npm start                    # Expo dev server
npm run ios                  # iOS simulator
npm run test:e2e            # Playwright E2E tests

# Testing
npm run test:e2e:dev        # E2E against dev environment
npm run test:e2e:prod       # E2E against production
dotnet test services/tests/functional/  # API functional tests
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

## General Guidelines

Please don't add any summary documents or markdown files unless asked.