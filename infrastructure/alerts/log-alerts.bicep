// ============================================================================
// Log-Search (KQL) Alert Rules
// Alerts: #2, #3, #4, #5, #6, #7, #8, #11, #12, #14, #15, #16, #21, #22, #23, #24
// Alert #14 moved here from metric-alerts (FunctionExecutionUnits is MB-ms, not duration)
// Alert #17 is deferred to Phase 3 (needs session baseline data)
// ============================================================================

@description('Environment name (dev or prod)')
param environment string

@description('Action Group resource ID')
param actionGroupId string

@description('Resource ID of the Log Analytics workspace backing App Insights')
param logAnalyticsWorkspaceId string

// ── Environment-specific thresholds ──────────────────────────────────────────

var isProd = environment == 'prod'

// Threshold-embedded KQL queries (count-based approach to avoid no-data phantom alerts)
var agentDurationQuery = 'AppMetrics | where Name == "AgentRequest.Duration" | summarize p95 = percentile(Sum, 95), datapoints = count() | where datapoints > 0 and p95 > ${isProd ? '15000' : '20000'}'
var voiceFailureQuery = 'AppMetrics | where Name == "voice.audio_failures_total" | summarize total = sum(Sum), datapoints = count() | where datapoints > 0 and total > ${isProd ? '3' : '5'}'
var voiceDurationQuery = 'AppMetrics | where Name == "voice.total_duration_ms" | summarize p95 = percentile(Sum, 95), datapoints = count() | where datapoints > 0 and p95 > ${isProd ? '15000' : '25000'}'
var funcDurationQuery = 'AppRequests | where AppRoleName has "function" or SDKVersion has "azurefunctions" | summarize p95 = percentile(DurationMs, 95), datapoints = count() | where datapoints > 0 and p95 > ${isProd ? '30000' : '60000'}'

// ============================================================================
// Alert #2 — HTTP 5xx Spike (Sev2)
// ============================================================================
resource http5xxAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-http-5xx-spike'
  location: resourceGroup().location
  properties: {
    description: 'Alert #2: HTTP 5xx responses are spiking. Unhandled exceptions in controllers.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where ResultCode startswith "5"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 5 : 10
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #3 — HTTP 429 Rate-Limit Rejections (Sev3)
// ============================================================================
resource http429Alert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-http-429-rejections'
  location: resourceGroup().location
  properties: {
    description: 'Alert #3: Rate-limited (429) responses indicate real users being throttled or potential abuse.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where ResultCode == "429"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 20 : 50
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #4 — Agent Request Duration P95 (Sev2)
// ============================================================================
resource agentDurationAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-agent-duration-p95'
  location: resourceGroup().location
  properties: {
    description: 'Alert #4: AI Agent request P95 latency is high. Users are experiencing slow responses.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: agentDurationQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #5 — Agent Fallback Response Rate (Sev2)
// ============================================================================
resource agentFallbackAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-agent-fallback-rate'
  location: resourceGroup().location
  properties: {
    description: 'Alert #5: AI agent is returning fallback responses. Foundry quality may be degraded.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "AgentResponse.FallbackUsed"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 3 : 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #6 — Agent Transient Retry Spike (Sev3)
// ============================================================================
resource agentRetryAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-agent-transient-retries'
  location: resourceGroup().location
  properties: {
    description: 'Alert #6: Elevated transient retries (429/502/503/504) from AI Foundry. Early signal before outages.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "AgentRequest.TransientRetry"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 10 : 15
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #7 — Low-Quality Response Retry Rate (Sev3)
// ============================================================================
resource lowQualityRetryAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-low-quality-retries'
  location: resourceGroup().location
  properties: {
    description: 'Alert #7: AI is returning placeholder/generic responses requiring retries. May indicate prompt drift.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "AgentResponse.LowQualityRetry"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 5 : 10
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #8 — Redis L2 Cache Failures (Sev2)
// ============================================================================
resource redisFailureAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-redis-l2-failures'
  location: resourceGroup().location
  properties: {
    description: 'Alert #8: Redis (Upstash) L2 cache failures. All traffic falls through to Cosmos DB + AI, spiking cost and latency.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppExceptions
            | where Properties.Operation startswith "CriteriaCache.L2"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 5 : 10
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #11 — Voice Processing Failures (Sev2)
// ============================================================================
resource voiceFailureAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-voice-failures'
  location: resourceGroup().location
  properties: {
    description: 'Alert #11: Voice processing (STT, Agent, or TTS) failed. Users on voice screen get no response.'
    severity: 2
    enabled: true // Re-enabled: voice metrics exist in LA workspace (AppMetrics table)
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: voiceFailureQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #12 — Voice Pipeline Duration P95 (Sev3)
// ============================================================================
resource voiceDurationAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-voice-duration-p95'
  location: resourceGroup().location
  properties: {
    description: 'Alert #12: Voice round-trip (STT → Agent → TTS) P95 latency is high. >15s feels broken.'
    severity: 3
    enabled: true // Re-enabled: voice metrics exist in LA workspace (AppMetrics table)
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: voiceDurationQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #15 — Client API Error Spike (Sev2)
// ============================================================================
resource clientApiErrorAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-client-api-errors'
  location: resourceGroup().location
  properties: {
    description: 'Alert #15: Mobile app encountering API failures. Cross-validates with server-side 5xx alert.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "Client.Error.Api"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 10 : 20
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #16 — Client Voice Error Spike (Sev3)
// ============================================================================
resource clientVoiceErrorAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-client-voice-errors'
  location: resourceGroup().location
  properties: {
    description: 'Alert #16: Voice feature failing on client side. May be microphone, encoding, or API failures.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "Client.Error.Voice"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 5 : 10
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #21 — Game Search Error Spike (Sev2)
// ============================================================================
resource gameSearchErrorAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-game-search-errors'
  location: resourceGroup().location
  properties: {
    description: 'Alert #21: Game Search API call failing from the client. Covers network errors, 5xx, or Cosmos timeouts.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "Client.Error.Search"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 5 : 10
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #22 — Game Setup Error Rate (Sev2)
// Prerequisite: Client.Error.GameSetup telemetry (Phase 0)
// ============================================================================
resource gameSetupErrorAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-game-setup-errors'
  location: resourceGroup().location
  properties: {
    description: 'Alert #22: Game Setup API failures. Users stuck without setup instructions.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name == "Client.Error.GameSetup"
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 3 : 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #23 — Feature Screen Navigation Failure (Sev2)
// KQL join: Feature.Tapped vs Screen.Viewed ratio per target screen
// ============================================================================
var navRatioThreshold = isProd ? '0.7' : '0.5'
var navFailureQueryTemplate = '''
AppEvents
| where Name == "Client.Feature.Tapped"
| extend target = tostring(Properties.target)
| summarize tapCount = count() by target
| join kind=leftouter (
    AppEvents
    | where Name == "Client.Screen.Viewed"
    | extend screenName = tostring(Properties.screenName)
    | summarize viewCount = count() by screenName
) on $left.target == $right.screenName
| extend viewCount = coalesce(viewCount, 0)
| where tapCount >= 3
| extend ratio = todouble(viewCount) / todouble(tapCount)
| where ratio < __THRESHOLD__
| project target, tapCount, viewCount, ratio
'''
var navFailureQuery = replace(navFailureQueryTemplate, '__THRESHOLD__', navRatioThreshold)

resource navigationFailureAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-feature-nav-failure'
  location: resourceGroup().location
  properties: {
    description: 'Alert #23: Users tap feature tiles but screen never renders. Indicates crash or navigation failure.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT30M'
    windowSize: 'PT1H'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: navFailureQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #24 — Tool Feature Error Spike (Sev3)
// Prerequisite: Error boundary telemetry (Phase 0)
// ============================================================================
resource toolFeatureErrorAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-tool-feature-errors'
  location: resourceGroup().location
  properties: {
    description: 'Alert #24: Runtime errors in local-only tool features (Timer, Team, Turn, Dice, Score).'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT30M'
    windowSize: 'PT1H'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppEvents
            | where Name in (
                "Client.Error.Timer",
                "Client.Error.TeamRandomizer",
                "Client.Error.TurnSelector",
                "Client.Error.DiceRoller",
                "Client.Error.ScoreTracker"
              )
            | summarize count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: isProd ? 3 : 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// ============================================================================
// Alert #14 — Function Execution Duration (Sev3)
// Moved from metric-alerts: FunctionExecutionUnits is MB-ms (not duration).
// Log-search against App Insights requests gives actual duration in ms.
// ============================================================================
resource functionDurationAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'gamer-uncle-${environment}-function-duration'
  location: resourceGroup().location
  properties: {
    description: 'Alert #14: Function execution duration P95 is abnormally high. BGG API or Cosmos upsert may be slow.'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: funcDurationQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}
