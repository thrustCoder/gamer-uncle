// ============================================================================
// Action Group — Notification channel for all alert rules
// Deployed per environment (dev / prod)
// ============================================================================

@description('Environment name (dev or prod)')
param environment string

@description('Email address for alert notifications')
param alertEmail string = 'rajarshi129@gmail.com'

var actionGroupName = 'gamer-uncle-${environment}-alerts-ag'
var shortName = 'gu-${environment}-ag'

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'Global'
  properties: {
    groupShortName: shortName
    enabled: true
    emailReceivers: [
      {
        name: 'AlertEmail'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
    azureAppPushReceivers: [
      {
        name: 'AzureMobileApp'
        emailAddress: alertEmail
      }
    ]
  }
}

@description('Resource ID of the action group')
output actionGroupId string = actionGroup.id
