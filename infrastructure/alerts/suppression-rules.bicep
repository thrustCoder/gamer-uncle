// ============================================================================
// Dev Alert Suppression Rules
// Suppresses alerts #1, #18, #19, #20 during the nightly scale-down window.
// The dev App Service Plan is scaled to F1 (free) at 07:00 UTC daily via
// pipelines/dev-scaledown-schedule.yml. During and after scale-down these
// alerts fire spuriously (cold-start delays, CPU/memory spikes, high latency).
//
// Suppression window: 06:45 UTC – 09:00 UTC daily
// Only deployed to dev environment. Prod has no suppression rules.
// ============================================================================

@description('Resource ID of the Dev App Service (gamer-uncle-dev-app-svc)')
param appServiceId string

@description('Resource ID of the Dev App Service Plan (gamer-uncle-dev-app-plan)')
param appServicePlanId string

// ============================================================================
// Alert Processing Rule — Suppress dev infra alerts during scale-down
// ============================================================================
resource scaledownSuppression 'Microsoft.AlertsManagement/actionRules@2021-08-08' = {
  name: 'gamer-uncle-dev-scaledown-suppression'
  location: 'Global'
  properties: {
    description: 'Suppress dev alerts #1, #18, #19, #20 during nightly F1 scale-down (06:45-09:00 UTC)'
    enabled: true
    scopes: [
      appServiceId
      appServicePlanId
    ]
    conditions: [
      {
        field: 'AlertRuleName'
        operator: 'Contains'
        values: [
          'gamer-uncle-dev-health-endpoint-down'
          'gamer-uncle-dev-cpu-high'
          'gamer-uncle-dev-memory-high'
          'gamer-uncle-dev-response-time-p95'
        ]
      }
    ]
    actions: [
      {
        actionType: 'RemoveAllActionGroups'
      }
    ]
    schedule: {
      effectiveFrom: '2025-01-01T06:45:00Z'
      recurrence: {
        recurrenceType: 'Daily'
        startTime: '06:45:00'
        endTime: '09:00:00'
      }
      timeZone: 'UTC'
    }
  }
}
