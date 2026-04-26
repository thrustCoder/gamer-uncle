// ============================================================================
// Azure Monitor Alerts — Main Orchestrator
//
// Deploys all alert infrastructure for the Gamer Uncle application:
//   - Action Group (email + Azure Mobile App push)
//   - 9 Platform Metric Alerts (#1, #9, #10, #13, #14, #18, #19, #20, #25)
//   - 15 Log-Search (KQL) Alerts (#2-#8, #11, #12, #15, #16, #21-#24)
//   - Dev-only suppression rules for nightly scale-down window
//   - Prod-only deployment suppression rule (toggled by CI/CD pipeline)
//
// Usage:
//   az deployment group create \
//     --resource-group gamer-uncle-{env}-rg \
//     --template-file infrastructure/alerts/main.bicep \
//     --parameters environment={env} \
//       appServiceId=/subscriptions/.../Microsoft.Web/sites/gamer-uncle-{env}-app-svc \
//       appServicePlanId=/subscriptions/.../Microsoft.Web/serverfarms/gamer-uncle-{env}-app-plan \
//       cosmosDbAccountId=/subscriptions/.../Microsoft.DocumentDB/databaseAccounts/gamer-uncle-{env}-cosmos \
//       functionAppId=/subscriptions/.../Microsoft.Web/sites/gamer-uncle-{env}-function \
//       appInsightsId=/subscriptions/.../Microsoft.Insights/components/gamer-uncle-{env}-app-insights \
//       aiServicesAccountId=/subscriptions/.../Microsoft.CognitiveServices/accounts/gamer-uncle-{env}-foundry
// ============================================================================

@description('Environment name: dev or prod')
@allowed(['dev', 'prod'])
param environment string

@description('Email address for alert notifications')
param alertEmail string = 'rajarshi129@gmail.com'

// ── Resource IDs (must be provided at deployment time) ──────────────────────

@description('Resource ID of the App Service (e.g. gamer-uncle-{env}-app-svc)')
param appServiceId string

@description('Resource ID of the App Service Plan (e.g. gamer-uncle-{env}-app-plan)')
param appServicePlanId string

@description('Resource ID of the Cosmos DB account (e.g. gamer-uncle-{env}-cosmos)')
param cosmosDbAccountId string

@description('Resource ID of the Function App (e.g. gamer-uncle-{env}-function)')
param functionAppId string

@description('Resource ID of the Application Insights instance')
param appInsightsId string

@description('Resource ID of the Log Analytics workspace backing App Insights')
param logAnalyticsWorkspaceId string

@description('Resource ID of the AI Services / Cognitive Services account')
param aiServicesAccountId string

// ============================================================================
// Module: Action Group
// ============================================================================
module actionGroup 'action-group.bicep' = {
  name: 'deploy-action-group-${environment}'
  params: {
    environment: environment
    alertEmail: alertEmail
  }
}

// ============================================================================
// Module: Platform Metric Alerts
// ============================================================================
module metricAlerts 'metric-alerts.bicep' = {
  name: 'deploy-metric-alerts-${environment}'
  params: {
    environment: environment
    actionGroupId: actionGroup.outputs.actionGroupId
    appServiceId: appServiceId
    appServicePlanId: appServicePlanId
    cosmosDbAccountId: cosmosDbAccountId
    functionAppId: functionAppId
    aiServicesAccountId: aiServicesAccountId
  }
}

// ============================================================================
// Module: Log-Search (KQL) Alerts
// ============================================================================
module logAlerts 'log-alerts.bicep' = {
  name: 'deploy-log-alerts-${environment}'
  params: {
    environment: environment
    actionGroupId: actionGroup.outputs.actionGroupId
    logAnalyticsWorkspaceId: logAnalyticsWorkspaceId
  }
}

// ============================================================================
// Module: Dev Suppression Rules (dev environment only)
// ============================================================================
module suppressionRules 'suppression-rules.bicep' = if (environment == 'dev') {
  name: 'deploy-suppression-rules-dev'
  params: {
    appServiceId: appServiceId
    appServicePlanId: appServicePlanId
  }
}

// ============================================================================
// Module: Prod Deployment Suppression (prod environment only)
// Toggled on/off by CI/CD pipeline during deployments to suppress
// cold-start latency alerts.
// ============================================================================
module deploymentSuppression 'deployment-suppression.bicep' = if (environment == 'prod') {
  name: 'deploy-deployment-suppression-${environment}'
  params: {
    environment: environment
    logAnalyticsWorkspaceId: logAnalyticsWorkspaceId
  }
}
