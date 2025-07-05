# Application Insights RBAC Configuration Guide

This guide explains how to configure Application Insights with RBAC (Role-Based Access Control) using managed identities for your GamerUncle API and Functions projects.

## Prerequisites

- Azure subscription
- Existing Application Insights resource
- API and Functions deployed to Azure (or will be deployed)

## Step 1: Get Application Insights Connection String

1. Navigate to your **Application Insights resource** in Azure Portal
2. Go to **Overview** section
3. Copy the **Connection String** (not the Instrumentation Key)
   - It should look like: `InstrumentationKey=12345678-1234-1234-1234-123456789012;IngestionEndpoint=https://westus2-1.in.applicationinsights.azure.com/;LiveEndpoint=https://westus2.livediagnostics.monitor.azure.com/`

## Step 2: Configure App Service (API) - RBAC Setup

### 2.1 Enable System-Assigned Managed Identity
1. Navigate to your **App Service** (API) in Azure Portal
2. Go to **Identity** → **System assigned**
3. Set **Status** to **On**
4. Click **Save**
5. Copy the **Object (principal) ID** that appears

### 2.2 Assign RBAC Role to App Service
1. Navigate to your **Application Insights resource**
2. Go to **Access control (IAM)**
3. Click **+ Add** → **Add role assignment**
4. Select **Role**: `Monitoring Metrics Publisher`
5. Select **Assign access to**: `Managed identity`
6. Click **+ Select members**
7. Select **Managed identity**: `App Service`
8. Select your API App Service
9. Click **Select** → **Review + assign** → **Assign**

### 2.3 Add Additional Role (Optional but Recommended)
Repeat step 2.2 with the role: `Monitoring Contributor` for full telemetry capabilities.

## Step 3: Configure Function App - RBAC Setup

### 3.1 Enable System-Assigned Managed Identity
1. Navigate to your **Function App** in Azure Portal
2. Go to **Identity** → **System assigned**
3. Set **Status** to **On**
4. Click **Save**
5. Copy the **Object (principal) ID** that appears

### 3.2 Assign RBAC Role to Function App
1. Navigate to your **Application Insights resource**
2. Go to **Access control (IAM)**
3. Click **+ Add** → **Add role assignment**
4. Select **Role**: `Monitoring Metrics Publisher`
5. Select **Assign access to**: `Managed identity`
6. Click **+ Select members**
7. Select **Managed identity**: `Function App`
8. Select your Function App
9. Click **Select** → **Review + assign** → **Assign**

### 3.3 Add Additional Role (Optional but Recommended)
Repeat step 3.2 with the role: `Monitoring Contributor` for full telemetry capabilities.

## Step 4: Configure Application Settings

### 4.1 App Service Configuration
1. Navigate to your **App Service** (API)
2. Go to **Configuration** → **Application settings**
3. Add/Update these settings:
   - **Name**: `ApplicationInsights__ConnectionString`
   - **Value**: `[Your Connection String from Step 1]`
4. Click **Save**

### 4.2 Function App Configuration
1. Navigate to your **Function App**
2. Go to **Configuration** → **Application settings**
3. Add/Update these settings:
   - **Name**: `APPLICATIONINSIGHTS_CONNECTION_STRING`
   - **Value**: `[Your Connection String from Step 1]`
4. Click **Save**

## Step 5: Verify RBAC Roles

### Check Role Assignments
1. Navigate to your **Application Insights resource**
2. Go to **Access control (IAM)** → **Role assignments**
3. Verify you see your App Service and Function App with the assigned roles:
   - Your API App Service: `Monitoring Metrics Publisher` (and optionally `Monitoring Contributor`)
   - Your Function App: `Monitoring Metrics Publisher` (and optionally `Monitoring Contributor`)

## Step 6: Required Roles Summary

| Service Type | Required Role | Purpose |
|--------------|---------------|---------|
| App Service | `Monitoring Metrics Publisher` | Send telemetry data to Application Insights |
| Function App | `Monitoring Metrics Publisher` | Send telemetry data to Application Insights |
| Both (Optional) | `Monitoring Contributor` | Full access including reading diagnostic settings |

## Step 7: Local Development Setup

For local development with Azure CLI:

```bash
# Login to Azure CLI
az login

# Set the correct subscription
az account set --subscription "your-subscription-id"
```

Add to your local `appsettings.Development.json`:
```json
{
  "ApplicationInsights": {
    "ConnectionString": "[Your Connection String]"
  }
}
```

## Step 8: Verification

After deployment, check that telemetry is working:

1. Navigate to your **Application Insights resource**
2. Go to **Live Metrics** to see real-time data
3. Go to **Logs** and run queries like:
   ```kql
   requests
   | where timestamp > ago(1h)
   | limit 10
   ```
4. Go to **Application Map** to see service dependencies

## Troubleshooting

### Common Issues:

1. **No telemetry data appearing**:
   - Verify connection string is correct
   - Check that managed identity is enabled
   - Verify RBAC roles are assigned correctly

2. **Authentication errors**:
   - Ensure the managed identity has the correct roles
   - Check that the connection string includes the endpoint URLs

3. **Local development not working**:
   - Ensure you're logged in with `az login`
   - Check that your Azure account has access to the Application Insights resource

### Verification Commands:

```bash
# Check current Azure login status
az account show

# List role assignments for your App Service
az role assignment list --assignee [YOUR-APP-SERVICE-PRINCIPAL-ID] --scope [YOUR-APP-INSIGHTS-RESOURCE-ID]
```

## Security Benefits of RBAC

- ✅ No connection strings in code
- ✅ Automatic credential rotation
- ✅ Fine-grained access control
- ✅ Audit trail of access
- ✅ Works seamlessly with Azure services

Your applications will now authenticate to Application Insights using managed identities instead of connection strings, providing better security and easier management.
