// ============================================================================
// Prod Deployment Suppression Rule
// Suppresses Alert #4 (Agent Duration P95) during prod API deployments.
//
// The API cold-starts after deployment, causing a transient P95 latency spike
// that exceeds the 15,000 ms threshold. This rule prevents that benign spike
// from firing a Sev2 alert.
//
// Lifecycle (managed by azure-pipelines.yml):
//   1. Pipeline ENABLES this rule before Prod API deployment
//   2. Pipeline DISABLES this rule after Prod Functional Tests complete
//
// Deployed disabled by default — only active during the deployment window.
// ============================================================================

@description('Environment name (should be prod)')
param environment string

@description('Resource ID of the Log Analytics workspace backing App Insights')
param logAnalyticsWorkspaceId string

// ============================================================================
// Alert Processing Rule — Suppress Alert #4 during prod deployments
// ============================================================================
resource deploymentSuppression 'Microsoft.AlertsManagement/actionRules@2021-08-08' = {
  name: 'gamer-uncle-${environment}-deploy-suppression'
  location: 'Global'
  properties: {
    description: 'Suppress Alert #4 (Agent Duration P95) during prod API deployments. Toggled by CI/CD pipeline.'
    enabled: false
    scopes: [
      logAnalyticsWorkspaceId
    ]
    conditions: [
      {
        field: 'AlertRuleName'
        operator: 'Equals'
        values: [
          'gamer-uncle-${environment}-agent-duration-p95'
        ]
      }
    ]
    actions: [
      {
        actionType: 'RemoveAllActionGroups'
      }
    ]
  }
}
