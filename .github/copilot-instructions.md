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

### Backend API Backward Compatibility (CRITICAL)
Real users may be running older versions of the mobile app at any time. A backend API change that breaks an older client is **catastrophic**. All backend API changes MUST be backward compatible with every client version **at or above** the `MinVersion` defined in `AppVersionPolicy` (see `appsettings.json` → `AppVersionPolicy:MinVersion`). Clients below `MinVersion` are force-upgraded, so breaking them is acceptable.

**Rules:**
- **NEVER remove or rename** an existing API endpoint, route, query parameter, or request/response JSON property that clients ≥ `MinVersion` rely on
- **NEVER change the type** of an existing JSON property (e.g., string → array, int → string)
- **NEVER change the semantic meaning** of an existing field or status code
- **New fields are safe to add** — older clients will simply ignore them
- **New optional query/body parameters are safe** — they must have sensible defaults so older clients that don't send them still work
- **New endpoints are safe** — they don't affect existing clients
- **Breaking changes targeting versions below `MinVersion` are allowed** — but first bump `MinVersion` and deploy the config change so those old clients are forced to upgrade before they hit the breaking endpoint

**If a breaking change is truly unavoidable:**
1. **Version the API** (e.g., `/v2/recommendations`) rather than modifying the existing endpoint
2. Keep the old endpoint working for at least **two release cycles** of the mobile app
3. Add a deprecation log warning on the old endpoint so usage can be tracked
4. Coordinate frontend and backend changes — update the mobile app to use the new endpoint, then retire the old one only after confirming no traffic remains

**Before merging any backend API change, verify:**
- Existing functional tests still pass without modification (they represent the old contract)
- The request/response JSON schema is a **superset** of the previous schema (additions only)
- Default values are provided for any new required server-side fields

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
$env:E2E_BASE_URL="https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net"
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

### Azure DevOps CLI Access (CRITICAL)
- **Do NOT use the Azure DevOps MCP tools** — they trigger an interactive browser login to the Microsoft tenant which will fail for personal accounts. Use the `az devops` / `az pipelines` CLI commands instead.
- **PAT Authentication**: The Azure DevOps PAT is stored in PowerShell SecretStore. Load it before any `az devops` CLI calls:
  ```powershell
  $pat = Get-Secret -Name "AzureDevOpsPAT" -AsPlainText
  $env:AZURE_DEVOPS_EXT_PAT = $pat
  ```
- **Defaults are pre-configured**: `az devops configure --list` shows org=`https://dev.azure.com/rpsingh129`, project=`Gamer Uncle`
- **Repo name**: `Gamer Uncle` (with space, not `gamer-uncle`)
- **Common commands**:
  ```powershell
  # List recent pipeline runs
  az pipelines runs list --top 5 --query "[].{id:id, buildNumber:buildNumber, result:result, reason:reason}" -o json

  # Find a specific build by number
  az pipelines runs list --query "[?buildNumber=='20260308.9']" -o json

  # Get failed tasks in a build
  az devops invoke --area build --resource timeline --route-parameters buildId=<ID> project="Gamer Uncle" --query "records[?result=='failed'].{name:name, type:type, logId:log.id}" -o json

  # Read build logs (use REST API for log content since az devops returns raw text)
  $headers = @{Authorization = "Basic $([Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat")))"}
  $response = Invoke-RestMethod -Uri "https://dev.azure.com/rpsingh129/Gamer%20Uncle/_apis/build/builds/<ID>/logs/<logId>?api-version=7.1" -Headers $headers
  $lines = $response -split "`n"
  $lines | Select-Object -Last 50  # or pipe to Select-String for filtering
  ```
- **PAT scope note**: The current PAT may not have Git read scope (PR API may return 401). Use `az pipelines` commands for build data instead.

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

3. **If `API_ENVIRONMENT` is `dev`, scale up the dev App Service** (it may be parked on F1/Free by the nightly schedule):
   ```zsh
   CURRENT_SKU=$(az appservice plan show --name gamer-uncle-dev-app-plan --resource-group gamer-uncle-dev-rg --query "sku.name" -o tsv)
   if [ "$CURRENT_SKU" != "B1" ]; then
     echo "Scaling dev App Service from $CURRENT_SKU to B1..."
     az appservice plan update --name gamer-uncle-dev-app-plan --resource-group gamer-uncle-dev-rg --sku B1
     echo "Waiting 30s for plan to stabilize..."
     sleep 30
   else
     echo "Dev App Service already on B1."
   fi
   ```
   - **Skip this step** if `API_ENVIRONMENT` is `prod` (prod App Service is always running)

4. **Create/update `.env.local`** with App Key and Speech API Key fetched from Azure Key Vault:
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

5. **Start the Expo mobile app** with dev-client:
   ```zsh
   cd /Users/rajarshisingh/r/Code3/gamer-uncle/apps/mobile && npx expo start --dev-client
   ```

**Important Notes for macOS "testit"**:
- **No local API server**: macOS uses Azure-hosted APIs (dev/prod), not a local server
- **Dev App Service scale-up**: When `API_ENVIRONMENT` is `dev`, the dev App Service may be parked on F1 (free) by the nightly schedule. Step 3 wakes it up. This is NOT needed for `prod` or `local`.
- App keys AND Speech API keys are fetched from Azure Key Vault based on environment
- The mobile app reads keys from environment variables via `.env.local` (gitignored)
- Use `--dev-client` flag with Expo for development builds
- Change `API_ENVIRONMENT` in `apps/mobile/config/apiConfig.ts` to switch between 'dev' or 'prod'

---

#### Windows Instructions

On **Windows**, the local API server is started for local development.

0. **Determine the environment** from `apps/mobile/config/apiConfig.ts`:
   - Read the `API_ENVIRONMENT` value ('local', 'dev', or 'prod')

0.5. **If `API_ENVIRONMENT` is `dev`, scale up the dev App Service** (it may be parked on F1/Free by the nightly schedule):
   ```powershell
   $currentSku = az appservice plan show --name gamer-uncle-dev-app-plan --resource-group gamer-uncle-dev-rg --query "sku.name" -o tsv
   if ($currentSku -ne 'B1') {
     Write-Host "Scaling dev App Service from $currentSku to B1..."
     az appservice plan update --name gamer-uncle-dev-app-plan --resource-group gamer-uncle-dev-rg --sku B1
     Write-Host "Waiting 30s for plan to stabilize..."
     Start-Sleep -Seconds 30
   } else {
     Write-Host "Dev App Service already on B1."
   }
   ```
   - **Skip this step** if `API_ENVIRONMENT` is `local` or `prod`
   - When `API_ENVIRONMENT` is `dev`, do NOT start a local API server (steps 4-5 below become step 4-only: skip step 5)

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

4. **Sync the dev app key into dotnet user-secrets** so the local API accepts the same key the mobile app sends:
   - **CRITICAL**: Without this, the local API uses the placeholder key from `appsettings.Development.json` which won't match the real Key Vault key in `.env.local`, causing "Invalid or missing app key" errors.
   ```powershell
   dotnet user-secrets set "ApiAuthentication:AppKey" $devKey --project "C:\Users\rajsin\r\Code\gamer-uncle\services\api\GamerUncle.Api.csproj"
   ```

5. **Start the API server in a new terminal window** (background process):
   - **CRITICAL**: Use `http://*:5001` to bind to all network interfaces (not just localhost) so the mobile device can connect
   ```powershell
   Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\rajsin\r\Code\gamer-uncle'; dotnet run --project services/api/GamerUncle.Api.csproj --urls 'http://*:5001'"
   ```

6. **Start the Expo mobile app in a new terminal window** (so the QR code is visible):
   - **CRITICAL**: Must use `Start-Process PowerShell` so the QR code is displayed in a real terminal window. Running Expo inline or in a background terminal hides the QR code from the user.
   - **Office/Corporate Wi-Fi**: If the user is on a corporate network (e.g., MSFTCONNECT) where the phone cannot reach the laptop directly (client isolation, no internet on phone Wi-Fi), use `--tunnel` instead of `--clear`:
     ```powershell
     Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile'; npx expo start --tunnel --clear"
     ```
     The tunnel routes through ngrok so the phone can connect over cellular data. The laptop must have outbound internet (disconnect from corp Ethernet if it blocks ngrok; use phone hotspot or guest Wi-Fi for laptop connectivity).
   - **Home/Normal Wi-Fi** (default): Use regular LAN mode:
   ```powershell
   Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile'; npx expo start --clear"
   ```
   - **Physical iPhone with a dev build (custom native modules — WebRTC/voice)**: The app is NOT Expo Go compatible, so use the `--dev-client` flag so the QR opens the installed dev build instead of Expo Go:
     ```powershell
     Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile'; npx expo start --dev-client --clear"
     ```
     - **"Gamer Uncle is no longer available" on launch**: The installed iOS dev build's ad-hoc provisioning profile expired/was revoked (or the app was removed). Rebuild + reinstall via EAS cloud (no local iOS build possible on Windows): from `apps/mobile` run `npx eas build --platform ios --profile development`. This is INTERACTIVE and needs Apple credentials — run it in a dedicated visible window (`cmd /c start "" powershell.exe -NoExit -Command "cd '...\apps\mobile'; npx eas build --platform ios --profile development"`) because `--non-interactive` fails with "Distribution Certificate is not validated". Answer `Y` to the Apple-account login prompt, then the user types the Apple password + 2FA DIRECTLY in that window (never route the password through the agent). After it finishes, open the build's Expo page on the iPhone in Safari and tap Install. Check for an already-finished build first with `npx eas build:list --platform ios --limit 3 --non-interactive` before kicking off a new ~15-20 min build.
     - **App launches but "nothing happens" / won't connect to Metro (LAN mode)**: On a home network (laptop `192.168.50.11`), the usual cause is Windows Firewall blocking inbound port 8081. Add a persistent allow rule (needs admin/UAC — the rule survives reboots so it's a one-time fix):
       ```powershell
       Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-Command',"New-NetFirewallRule -DisplayName 'Metro 8081' -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Any"
       ```
       Then verify Metro is reachable on the LAN IP the phone will use: `Invoke-WebRequest -Uri "http://192.168.50.11:8081/status" -UseBasicParsing` (expect 200 `packager-status:running`). Ensure the phone is on the SAME Wi-Fi subnet (not Guest/cellular). As a fallback, in the app's dev launcher tap "Enter URL manually" and type `http://192.168.50.11:8081`.
     - **Tunnel fallback pitfalls**: `--tunnel` needs `@expo/ngrok` (pre-install once with `npm install --global @expo/ngrok@^4.1.0` so the tunnel doesn't hang on a Y/n install prompt in a window you can't see). If the tunnel fails with "failed to start tunnel / remote gone away", the laptop's outbound path to ngrok is blocked (VPN/corp) — prefer LAN mode + firewall rule on a home network; only use tunnel when the phone genuinely can't share the laptop's LAN.

7. **If targeting an Android emulator (e.g. Pixel 7 via Android Studio AVD), connect it to Metro** — a QR code is useless for emulators, and the emulator CANNOT reach Metro via the host LAN IP (e.g. `192.168.50.11:8081`) that Expo advertises by default. The emulator runs in its own virtual network, so it must reach Metro over loopback through an `adb reverse` tunnel.

   **7a. CRITICAL FIRST CHECK — is the installed APK an actual debuggable dev-client build?** A non-debuggable EAS *preview/production* APK has the JS bundle baked in and **physically cannot connect to Metro** — `r` / Fast Refresh / relaunch will silently do nothing, no matter how Metro or adb is configured. Always verify this BEFORE touching Metro/adb:
     ```powershell
     $adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
     if (-not (Test-Path $adb)) {
       $adb = (Get-ChildItem -Path "$env:LOCALAPPDATA\Android","$env:ProgramFiles\Android","$env:USERPROFILE" -Filter adb.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)
     }
     $pkgInfo = & $adb shell dumpsys package com.thrustCoder.gamerUncle 2>$null | Out-String
     $isInstalled = $pkgInfo -match 'versionName='
     # A real dev build is DEBUGGABLE (flags include 0x2 / DEBUGGABLE) and ships expo-dev-launcher
     $isDebuggable = ($pkgInfo -match 'DEBUGGABLE') -or ($pkgInfo -match 'flags=\[[^\]]*DEBUGGABLE')
     $hasDevLauncher = ($pkgInfo -match 'devlauncher') -or ($pkgInfo -match 'DevLauncher')
     $isDevBuild = $isInstalled -and ($isDebuggable -or $hasDevLauncher)
     Write-Output ("Installed: $isInstalled | Debuggable: $isDebuggable | DevLauncher: $hasDevLauncher | Usable dev build: $isDevBuild")
     ```
     - **If `Usable dev build: False`** (not installed, OR an embedded-bundle preview/prod APK like EAS build `e98d89b3`), you MUST build a local development build. This is a **local Gradle build — no Expo server queue** — and is the one-shot path the user wants from "testit":
       ```powershell
       # Builds a debuggable dev-client APK via Gradle, installs it on the emulator,
       # starts Metro, and auto-connects with Fast Refresh. First run runs expo prebuild
       # (generates android/) and takes several minutes; subsequent runs are fast.
       Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile'; npx expo run:android"
       ```
       `expo run:android` handles install + Metro + connect itself, so when you take this branch you can SKIP steps 7b–7e below. Requires a JDK 17 and the Android SDK (emulator already working). The app's native modules (WebRTC, voice) are why a dev build — not Expo Go — is mandatory.
     - **If `Usable dev build: True`**, the existing APK is fine; continue with 7b–7e to (re)connect it to Metro.

   **7b. PREFER starting Metro in localhost mode for emulators.** LAN mode (plain `npx expo start`) advertises the host LAN IP; the emulator can still fetch the bundle through the reverse tunnel (so the app shows current code), but the Fast Refresh / reload websocket never stays attached — pressing **`r`** then prints "No apps connected" and nothing live-reloads. Starting Metro with `--localhost` makes BOTH the bundle and the reload websocket use `localhost:8081`, matching the tunnel:
     ```powershell
     Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile'; npx expo start --dev-client --localhost --clear"
     ```
   **7c. Confirm the emulator is connected** and the dev-client app is installed (package `com.thrustCoder.gamerUncle`) — `$adb` was resolved in 7a:
     ```powershell
     & $adb devices
     & $adb shell pm list packages | Select-String "gamer"
     ```
   **7d. Set up the reverse tunnel(s)** so the emulator's loopback maps to the host. Port 8081 (Metro) is the one that matters for live refresh; 5001 (local API) is optional because `apiConfig.ts` already routes Android's `local` env to `10.0.2.2:5001`:
     ```powershell
     & $adb reverse tcp:8081 tcp:8081
     & $adb reverse tcp:5001 tcp:5001   # optional; only if forcing localhost for the API
     ```
   **7e. Launch (or relaunch) the dev client pointed at `localhost:8081`**, NOT the LAN IP. Force-stop first so it picks up the new URL instead of reusing the old LAN-IP session. **URL-encode the `url` query value** — an un-encoded `://` and `:` break intent parsing and the dev client silently ignores the URL:
     ```powershell
     & $adb shell am force-stop com.thrustCoder.gamerUncle
     Start-Sleep -Seconds 1
     & $adb shell am start -a android.intent.action.VIEW -d "exp+gamer-uncle://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.thrustCoder.gamerUncle
     ```
     (With Metro in `--localhost` mode you can instead just press **`a`** in the Expo window to install/open the app at `localhost:8081` directly.)
   - **Verify Metro is reachable** on 8081 (expect HTTP 200 with `packager-status:running`):
     ```powershell
     try { (Invoke-WebRequest -Uri "http://localhost:8081/status" -UseBasicParsing -TimeoutSec 5).StatusCode } catch { Write-Output "Metro NOT reachable: $($_.Exception.Message)" }
     ```
   - **Confirm the app actually loaded the bundle from Metro** (definitive success signal). The reliable proof is a unique ASCII marker temporarily added to a visible screen showing up on the device — but for routine runs the `Running "main"` logcat line plus the app rendering current code is enough:
     ```powershell
     & $adb logcat -d -t 1500 2>$null | Select-String -Pattern 'ReactNativeJS: Running "main"|Unable to load script|Could not connect' | Select-Object -Last 5
     ```
     Note: `http://localhost:8081/json/list` reporting 0 targets is NOT a failure — Hermes CDP inspector targets only register when a debugger attaches; the `Running "main"` logcat line is the reliable "app is connected" indicator.

**Important Notes for Windows "testit"**:
- Both the API server AND the Expo dev server MUST run in separate PowerShell windows (via `Start-Process PowerShell`)
- The Expo dev server MUST be in its own terminal window so the QR code is visible for scanning
- App keys are fetched from Azure Key Vault and written to `.env.local` (gitignored)
- The mobile app reads keys from environment variables via `.env.local`
- Use `--clear` flag with Expo to ensure a fresh cache start
- Existing dotnet and Metro/Node processes are killed to prevent port conflicts
- Change `API_ENVIRONMENT` in `apps/mobile/config/apiConfig.ts` to switch between 'local', 'dev', or 'prod'

**Important Notes for Windows "testit"**:
- Both the API server AND the Expo dev server MUST run in separate PowerShell windows (via `Start-Process PowerShell`)
- The Expo dev server MUST be in its own terminal window so the QR code is visible for scanning
- App keys are fetched from Azure Key Vault and written to `.env.local` (gitignored)
- The mobile app reads keys from environment variables via `.env.local`
- Use `--clear` flag with Expo to ensure a fresh cache start
- Existing dotnet and Metro/Node processes are killed to prevent port conflicts
- Change `API_ENVIRONMENT` in `apps/mobile/config/apiConfig.ts` to switch between 'local', 'dev', or 'prod'
- **Dev App Service scale-up**: When `API_ENVIRONMENT` is `dev`, the dev App Service may be parked on F1 (free) by the nightly schedule. Step 0.5 wakes it up. When using `dev`, do NOT start a local API server — the mobile app connects to Azure dev via AFD.
- **Local does NOT need scale-up**: When `API_ENVIRONMENT` is `local`, the mobile app hits `localhost:5001` (local API server), not the dev App Service.
- **Android emulator NOTHING refreshes (most common root cause)**: If `r`, Fast Refresh, AND relaunch all fail to show code changes on the emulator, the installed APK is almost certainly a **non-debuggable EAS preview/production build** (e.g. build `e98d89b3`) with the JS bundle baked in — it CANNOT connect to Metro at all. Diagnose with step 7a (`dumpsys package … | Select-String DEBUGGABLE`); a usable dev build is DEBUGGABLE and ships expo-dev-launcher. Definitive proof: add a unique ASCII marker (e.g. `ZZTESTZZ`) to a visible screen, confirm it IS in Metro's served bundle (`Invoke-WebRequest http://localhost:8081/index.bundle?platform=android&dev=true | … Contains 'ZZTESTZZ'` → True) but does NOT appear on the device after relaunch → the app is running an embedded bundle, not Metro. Fix: build a local debuggable dev build with `npx expo run:android` (step 7a). NOTE: a real `⚡`/emoji marker gets unicode-escaped (`\u26a1`) in the bundle, so a literal-emoji `Contains` check gives false negatives — use a plain ASCII marker when testing.
- **Android emulator refresh troubleshooting**: "No apps connected. Sending 'reload' to all React Native apps failed" means the dev client has no live reload websocket attached to Metro. Assuming the APK IS a real dev build (see above), the usual cause is Metro running in **LAN mode** (advertising `192.168.50.11:8081`): the emulator fetches the bundle through the `adb reverse` tunnel (so the app shows current code) but the Fast Refresh websocket never stays attached, so `r` does nothing. Fix by restarting Metro with `--localhost` (`npx expo start --dev-client --localhost --clear`), re-assert `adb reverse tcp:8081 tcp:8081`, then force-stop + relaunch the app at the URL-encoded `http%3A%2F%2Flocalhost%3A8081`. Confirm success with the `ReactNativeJS: Running "main"` logcat line (NOT `/json/list`, which legitimately shows 0 targets). Reverse tunnels survive app restarts but are CLEARED on emulator cold boot — re-run the `adb reverse` commands after rebooting the emulator. `adb reverse` does not require root and works on standard AVDs.
- **Android emulator local API**: With `API_ENVIRONMENT='local'`, Android resolves the local API to `http://10.0.2.2:5001/api/` (the emulator's built-in host-loopback alias) via `apiConfig.ts` — no `adb reverse` needed for the API. `localhost`/`127.0.0.1` on the emulator would point at the emulator itself, and the host LAN IP is typically unroutable from the AVD.
- **Office/Corporate network troubleshooting**: Corporate networks like MSFTCONNECT block device-to-device LAN traffic and may block ngrok tunnels too. If `--tunnel` fails with "remote gone away", the laptop's outbound internet is blocked — disconnect from corp Ethernet, use iPhone Personal Hotspot for laptop internet, then retry `--tunnel`. The phone should use cellular data (not corp Wi-Fi) to reach the tunnel URL. ADB is Android-only and won't work with iOS devices.

## Mobile App Versioning (iOS + Android lockstep)

The mobile app ships iOS and Android from the same commit using a single shared SemVer. Follow these rules for any release-affecting change in `apps/mobile/app.json`:

- **One SemVer per release**: Bump `expo.version` once per release. This is the single source of truth and feeds iOS `CFBundleShortVersionString` and Android `versionName` automatically.
- **Every store upload needs a new version**: Google Play requires `android.versionCode` to strictly increase on every upload, and Apple requires `ios.buildNumber` to strictly increase per App Store upload — independent of SemVer. Because we keep SemVer in lockstep, treat **every store upload as a new SemVer** (even a no-code-change rebuild requires bumping `expo.version`).
- **Bump both build counters together**: When you bump `expo.version`, also bump **both** `ios.buildNumber` and `android.versionCode` for that release. Never let either platform's build counter go backwards on its respective store; each must be monotonically increasing per store.
- **Keep them aligned**: `ios.buildNumber` and `android.versionCode` are separate counters but should be advanced in the same release commit so the two platforms stay traceable to one SemVer.

## Pull Request Conventions
- **PR title prefix**: Always prefix the PR title with the version indicator extracted from the branch name. For example, if the branch is `users/rajsin/v3.5.8`, the PR title should start with `v3.5.8 - `.
- **GitHub account**: Always create PRs using the `thrustCoder` GitHub account. If `gh auth status` shows a different active account, run `gh auth switch --user thrustCoder` before creating the PR.

## General Guidelines

Please don't add any summary documents or markdown files unless asked.

<!-- mermaid-ai-skills:start -->
## Mermaid Diagrams

When the user asks to create, edit, or visualize a diagram, follow the
instructions in `.github/instructions/mermaid.instructions.md`.
<!-- mermaid-ai-skills:end -->
