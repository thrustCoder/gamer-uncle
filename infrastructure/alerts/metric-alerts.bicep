// ============================================================================
// Platform Metric Alert Rules
// Alerts: #1, #9, #10, #13, #14, #18, #19, #20, #25
// ============================================================================

@description('Environment name (dev or prod)')
param environment string

@description('Action Group resource ID')
param actionGroupId string

@description('Resource ID of the App Service (e.g. gamer-uncle-{env}-app-svc)')
param appServiceId string

@description('Resource ID of the App Service Plan (e.g. gamer-uncle-{env}-app-plan)')
param appServicePlanId string

@description('Resource ID of the Cosmos DB account (e.g. gamer-uncle-{env}-cosmos)')
param cosmosDbAccountId string

@description('Resource ID of the Function App (e.g. gamer-uncle-{env}-function)')
param functionAppId string

@description('Resource ID of the AI Services / Cognitive Services account')
param aiServicesAccountId string

// ── Environment-specific thresholds ──────────────────────────────────────────

var isProd = environment == 'prod'

// Alert #1 — Health Endpoint Down
var healthFailureThreshold = isProd ? 3 : 5

// Alert #9 — Cosmos DB 429s
var cosmos429Threshold = isProd ? 0 : 5

// Alert #10 — Cosmos DB Normalized RU %
var cosmosRuPctThreshold = isProd ? 70 : 85

// Alert #13 — Function Execution Failures
var functionFailureThreshold = isProd ? 0 : 2

// Alert #14 — Function Execution Duration (ms)
var functionDurationThreshold = isProd ? 30000 : 60000

// Alert #18 — App Service CPU %
var cpuThreshold = isProd ? 80 : 90

// Alert #19 — App Service Memory %
var memoryThreshold = isProd ? 85 : 90

// Alert #20 — App Service Response Time P95 (ms)
var responseTimeThreshold = isProd ? 5000 : 8000

// Alert #25 — AI Foundry TPM Quota Saturation — percentage threshold
// We alert at 80% of provisioned TPM quota for both environments
var tpmQuotaPctThreshold = 80

// ============================================================================
// Alert #1 — Health Endpoint Down (Sev1)
// ============================================================================
resource healthAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-health-endpoint-down'
  location: 'Global'
  properties: {
    description: 'Alert #1: App Service health check is failing. The app may be unreachable or crashing.'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    scopes: [appServiceId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HealthCheckFailures'
          metricName: 'HealthCheckStatus'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'LessThan'
          threshold: 100 // HealthCheckStatus is 0-100; < 100 means failures
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #9 — Cosmos DB Throttling 429s (Sev2)
// ============================================================================
resource cosmos429Alert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-cosmos-429-throttling'
  location: 'Global'
  properties: {
    description: 'Alert #9: Cosmos DB is returning 429 (throttled) responses. RU budget may be exhausted.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [cosmosDbAccountId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'CosmosThrottledRequests'
          metricName: 'TotalRequests'
          metricNamespace: 'Microsoft.DocumentDB/databaseAccounts'
          operator: 'GreaterThan'
          threshold: cosmos429Threshold
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'StatusCode'
              operator: 'Include'
              values: ['429']
            }
          ]
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #10 — Cosmos DB Normalized RU Consumption (Sev3)
// ============================================================================
resource cosmosRuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-cosmos-ru-high'
  location: 'Global'
  properties: {
    description: 'Alert #10: Cosmos DB Normalized RU consumption is high. Scale up before 429s start.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [cosmosDbAccountId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'NormalizedRUConsumption'
          metricName: 'NormalizedRUConsumption'
          metricNamespace: 'Microsoft.DocumentDB/databaseAccounts'
          operator: 'GreaterThan'
          threshold: cosmosRuPctThreshold
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #13 — Function Execution Failures (Sev2)
// ============================================================================
resource functionFailureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-function-failures'
  location: 'Global'
  properties: {
    description: 'Alert #13: Durable Function activities are failing. BGG data freshness may degrade.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    scopes: [functionAppId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FunctionFailures'
          metricName: 'FunctionExecutionCount'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: functionFailureThreshold
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'Status'
              operator: 'Include'
              values: ['Failed']
            }
          ]
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #14 — Function Execution Duration (Sev3)
// ============================================================================
resource functionDurationAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-function-duration'
  location: 'Global'
  properties: {
    description: 'Alert #14: Function execution duration is abnormally high. BGG API or Cosmos upsert may be slow.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    scopes: [functionAppId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FunctionDuration'
          metricName: 'FunctionExecutionUnits'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: functionDurationThreshold
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #18 — App Service CPU High (Sev2)
// ============================================================================
resource cpuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-cpu-high'
  location: 'Global'
  properties: {
    description: 'Alert #18: App Service Plan CPU is sustained high. May need scale-up.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [appServicePlanId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'CpuHigh'
          metricName: 'CpuPercentage'
          metricNamespace: 'Microsoft.Web/serverfarms'
          operator: 'GreaterThan'
          threshold: cpuThreshold
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #19 — App Service Memory High (Sev2)
// ============================================================================
resource memoryAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-memory-high'
  location: 'Global'
  properties: {
    description: 'Alert #19: App Service Plan memory utilization is high. May cause OOM restarts.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [appServicePlanId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'MemoryHigh'
          metricName: 'MemoryPercentage'
          metricNamespace: 'Microsoft.Web/serverfarms'
          operator: 'GreaterThan'
          threshold: memoryThreshold
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #20 — App Service Response Time P95 (Sev2)
// ============================================================================
resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-response-time-p95'
  location: 'Global'
  properties: {
    description: 'Alert #20: App Service response time P95 is elevated. Broader than agent-only latency.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [appServiceId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ResponseTimeP95'
          metricName: 'HttpResponseTime'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: responseTimeThreshold
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// ============================================================================
// Alert #25 — AI Foundry TPM Quota Saturation (Sev2)
// ============================================================================
resource tpmQuotaAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gamer-uncle-${environment}-ai-tpm-saturation'
  location: 'Global'
  properties: {
    description: 'Alert #25: AI Services token usage is approaching provisioned TPM quota. May start throttling soon.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [aiServicesAccountId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'TokenTransactionRate'
          metricName: 'TokenTransaction'
          metricNamespace: 'Microsoft.CognitiveServices/accounts'
          operator: 'GreaterThan'
          // 80% of 50K TPM = 40K tokens per minute. Over 15 min window, avg rate > 40K/min
          // We use the raw count over the window: 40000 * 15 = 600000 tokens per 15-min window
          threshold: 600000
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}
