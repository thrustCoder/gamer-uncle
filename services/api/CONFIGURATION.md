# API Configuration Guide

## Azure Speech Service Configuration

### ⚠️ IMPORTANT: Never commit API keys to git!

Azure Speech Service requires authentication keys. These should **NEVER** be committed to the repository.

### Setup Methods (Choose One)

#### Option 1: Environment Variables (Recommended)

Set these environment variables before running the API:

**Windows PowerShell:**
```powershell
$env:AZURE_SPEECH_KEY_DEV="your-dev-key-here"
$env:AZURE_SPEECH_KEY_PROD="your-prod-key-here"
```

**Windows CMD:**
```cmd
set AZURE_SPEECH_KEY_DEV=your-dev-key-here
set AZURE_SPEECH_KEY_PROD=your-prod-key-here
```

**Linux/Mac:**
```bash
export AZURE_SPEECH_KEY_DEV="your-dev-key-here"
export AZURE_SPEECH_KEY_PROD="your-prod-key-here"
```

#### Option 2: User Secrets (Development Only)

For local development, use .NET user secrets:

```bash
# Navigate to API directory
cd services/api

# Set development key
dotnet user-secrets set "AzureSpeech:Key" "your-dev-key-here"

# View all secrets
dotnet user-secrets list
```

#### Option 3: Azure Key Vault (Production)

For production, use Azure Key Vault with Managed Identity:

1. Store keys in Azure Key Vault
2. Configure the API to use `DefaultAzureCredential`
3. Grant the App Service Managed Identity access to Key Vault

### Getting Azure Speech Service Keys

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to your Azure Speech Service resource
3. Click **Keys and Endpoint** in the left menu
4. Copy **Key 1** or **Key 2**
5. Note the **Region** (e.g., `westus`, `eastus2`)

### Configuration Files

- `appsettings.json` - Base configuration (empty Key value)
- `appsettings.Development.json` - Development overrides (empty Key value)
- `appsettings.Production.json` - Production overrides (empty Key value)

All `Key` values should be empty strings in git. Actual keys are provided via:
- Environment variables
- User secrets (development)
- Azure Key Vault (production)

### Verifying Configuration

After setting up keys, verify the configuration:

```bash
# Start the API
dotnet run --project services/api

# Check health endpoint (should show azure_auth as Healthy)
curl http://localhost:5000/health
```

### If Keys Are Accidentally Committed

If you accidentally commit API keys:

1. **IMMEDIATELY** rotate the keys in Azure Portal
2. Revert the commit with keys
3. Never push the commit to remote
4. Consider the old keys compromised

### CI/CD Configuration

For Azure DevOps or GitHub Actions:

1. Add keys as pipeline secrets/variables
2. Inject them as environment variables during deployment
3. Never store them in pipeline YAML files
