# Azure Speech Service Key Vault Configuration

## Overview
Azure Speech Service API keys are now securely stored in Azure Key Vault instead of being hardcoded in application settings. The API retrieves keys at runtime using Managed Identity authentication.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│  App Service    │         │   Key Vault      │         │  Azure Speech       │
│  (Dev/Prod)     │────────▶│  (Dev/Prod)      │         │  Service            │
│                 │  RBAC   │                  │         │  (Dev/Prod)         │
│  Managed        │         │  Secret:         │         │                     │
│  Identity       │         │  AzureSpeechKey  │─────────▶│  API Key            │
└─────────────────┘         └──────────────────┘  Stored  └─────────────────────┘
```

## Configuration Details

### Dev Environment
- **Key Vault**: `gamer-uncle-dev-vault`
- **Resource Group**: `gamer-uncle-dev-rg`
- **Key Vault URI**: `https://gamer-uncle-dev-vault.vault.azure.net/`
- **Secret Name**: `AzureSpeechKey`
- **App Service**: `gamer-uncle-dev-app-svc`
- **App Service Identity**: `45c72f2a-f5bb-446e-b81e-03511895c838`
- **Speech Service**: `gamer-uncle-dev-speech` (F0 tier, westus region)

### Prod Environment
- **Key Vault**: `gamer-uncle-prod-vault`
- **Resource Group**: `gamer-uncle-prod-rg`
- **Key Vault URI**: `https://gamer-uncle-prod-vault.vault.azure.net/`
- **Secret Name**: `AzureSpeechKey`
- **App Service**: `gamer-uncle-prod-app-svc`
- **App Service Identity**: `2b84860c-29a6-4868-be7f-e4b1bd0eaf30`
- **Speech Service**: `gamer-uncle-prod-speech` (S0 tier, westus region)

## RBAC Permissions

Both App Services have been granted **Key Vault Secrets User** role:
- Read-only access to Key Vault secrets
- No ability to create, update, or delete secrets
- Uses Managed Identity (no credentials stored in code)

## Code Changes

### 1. Configuration Schema Update
Changed from:
```json
"AzureSpeech": {
  "Key": "<hardcoded-key>",
  "Region": "westus",
  "DefaultVoice": "en-US-AvaMultilingualNeural"
}
```

To:
```json
"AzureSpeech": {
  "KeyVaultUri": "https://gamer-uncle-dev-vault.vault.azure.net/",
  "KeySecretName": "AzureSpeechKey",
  "Region": "westus",
  "DefaultVoice": "en-US-AvaMultilingualNeural"
}
```

### 2. AzureSpeechService.cs Updates
```csharp
// Added package
using Azure.Security.KeyVault.Secrets;
using Azure.Identity;

// Retrieve key from Key Vault
var keyVaultClient = new SecretClient(new Uri(keyVaultUri), new DefaultAzureCredential());
var secretResponse = keyVaultClient.GetSecret(keySecretName);
var speechKey = secretResponse.Value.Value;
```

### 3. Dependencies Added
- **Azure.Security.KeyVault.Secrets** v4.8.0
- **Azure.Core** updated to v1.46.2

## Verification

Run the verification script to check configuration:
```powershell
.\scripts\verify-speech-keyvault.ps1
```

Expected output:
- All 6 checks PASS for both Dev and Prod environments
- No hardcoded keys remain in App Service settings

## Security Benefits

1. **No Hardcoded Secrets**: API keys are never stored in source control or configuration files
2. **Centralized Management**: Keys stored in one secure location (Key Vault)
3. **Audit Trail**: All secret access is logged in Key Vault diagnostics
4. **Easy Rotation**: Keys can be rotated in Key Vault without code deployment
5. **Least Privilege**: App Service only has read access to specific secrets

## Key Rotation Procedure

When rotating Azure Speech Service keys:

1. **Get new key from Speech Service**:
   ```powershell
   az cognitiveservices account keys regenerate `
     --name gamer-uncle-dev-speech `
     --resource-group gamer-uncle-dev-rg `
     --key-name key1
   ```

2. **Update Key Vault secret**:
   ```powershell
   az keyvault secret set `
     --vault-name gamer-uncle-dev-vault `
     --name "AzureSpeechKey" `
     --value "<new-key-value>"
   ```

3. **Restart App Service** (Key Vault client caches secrets):
   ```powershell
   az webapp restart `
     --name gamer-uncle-dev-app-svc `
     --resource-group gamer-uncle-dev-rg
   ```

4. **Verify functionality**: Test `/api/voice/process` endpoint

## Monitoring

### Application Insights Queries

**Check Key Vault access logs**:
```kusto
traces
| where message contains "AzureSpeechService initialized"
| project timestamp, message, customDimensions
| order by timestamp desc
| take 50
```

**Monitor Speech Service authentication failures**:
```kusto
exceptions
| where outerMessage contains "Speech" or outerMessage contains "401"
| project timestamp, outerMessage, customDimensions
| order by timestamp desc
```

### Key Vault Diagnostics

Enable diagnostics in Key Vault to track:
- Secret access events
- Failed authentication attempts
- RBAC permission changes

## Troubleshooting

### Issue: "401 Unauthorized" from Speech Service
**Cause**: Key Vault secret may be incorrect or expired  
**Solution**:
1. Verify secret value in Key Vault matches Speech Service key
2. Check Speech Service key hasn't been regenerated
3. Restart App Service to refresh cached credentials

### Issue: "Key Vault access denied"
**Cause**: RBAC role assignment missing or propagation delay  
**Solution**:
1. Verify role assignment: Run `verify-speech-keyvault.ps1`
2. Wait 5-10 minutes for RBAC propagation
3. Check Managed Identity is enabled on App Service

### Issue: "Configuration missing" error on startup
**Cause**: App Service configuration not updated  
**Solution**:
1. Verify `AzureSpeech__KeyVaultUri` is set in App Service settings
2. Verify `AzureSpeech__KeySecretName` is set to "AzureSpeechKey"
3. Remove old `AzureSpeech__Key` setting if present

## Files Modified

### Configuration Files
- `services/api/appsettings.json`
- `services/api/appsettings.Development.json`
- `services/api/appsettings.Production.json`
- `services/api/appsettings.Testing.json`

### Code Files
- `services/api/Services/Speech/AzureSpeechService.cs`
- `services/api/GamerUncle.Api.csproj` (package references)

### Scripts
- `scripts/verify-speech-keyvault.ps1` (new)

## Testing

### Local Development
For local testing with user credentials:
```powershell
# Ensure you're logged in to Azure CLI
az login

# Your user account needs Key Vault Secrets User role
# Run the app - it will use your Azure CLI credentials
dotnet run --project services/api/
```

### Functional Tests
Tests will use Dev Key Vault via `appsettings.Testing.json`:
```powershell
dotnet test services/tests/functional/
```

## Deployment Notes

⚠️ **Important**: After deploying updated code to App Services, you MUST restart them for changes to take effect:

```powershell
# Dev
az webapp restart --name gamer-uncle-dev-app-svc --resource-group gamer-uncle-dev-rg

# Prod
az webapp restart --name gamer-uncle-prod-app-svc --resource-group gamer-uncle-prod-rg
```

## Compliance

This implementation follows Azure security best practices:
- ✅ **No secrets in source control**
- ✅ **Managed Identity authentication**
- ✅ **Principle of least privilege (read-only access)**
- ✅ **Audit logging enabled**
- ✅ **Key rotation support**
- ✅ **Environment isolation (separate Key Vaults)**

---

**Last Updated**: January 2025  
**Configuration Status**: ✅ Verified on both Dev and Prod environments
