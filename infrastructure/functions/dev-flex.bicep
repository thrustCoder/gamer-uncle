targetScope = 'resourceGroup'

// Preparation only: deployment and access grants require separate approval.
// Deploy only to the assessed subscription's gamer-uncle-dev-rg.
var location = 'westus'
var appName = 'gamer-uncle-dev-function-flex'
var planName = 'gamer-uncle-dev-flex-plan'
var storageName = 'gameruncledevflexsa'
var hubName = 'GamerUncleDevNet10Flex'
var deploymentContainerName = 'function-releases'
var tags = {
  environment: 'dev'
  component: 'bgg-sync'
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: 'gamer-uncle-dev-function-uami'
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: 'gamer-uncle-dev-cosmos'
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: 'gamer-uncle-dev-app-insights'
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'gamer-uncle-dev-vault'
}

resource bggSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: vault
  name: 'BggApiBearerToken'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'Storage Blob Data Owner')
  scope: storage
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
  }
}

resource queueAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'Storage Queue Data Contributor')
  scope: storage
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
  }
}

resource tableAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'Storage Table Data Contributor')
  scope: storage
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
  }
}

resource secretAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(bggSecret.id, identity.id, 'Key Vault Secrets User')
  scope: bggSecret
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    reserved: true
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    keyVaultReferenceIdentity: identity.id
    functionAppConfig: {
      runtime: {
        name: 'dotnet-isolated'
        version: '10.0'
      }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainer.name}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: identity.id
          }
        }
      }
      scaleAndConcurrency: {
        instanceMemoryMB: 2048
        maximumInstanceCount: 1
        alwaysReady: []
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AZURE_FUNCTIONS_ENVIRONMENT'
          value: 'Development'
        }
        {
          name: 'AZURE_TENANT_ID'
          value: subscription().tenantId
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: identity.properties.clientId
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmos.properties.documentEndpoint
        }
        {
          name: 'COSMOS_DATABASE_NAME'
          value: 'gamer-uncle-dev-cosmos-container'
        }
        {
          name: 'COSMOS_CONTAINER_NAME'
          value: 'Games'
        }
        {
          name: 'BggApiBearerToken'
          value: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/${bggSecret.name})'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'APPLICATIONINSIGHTS_AUTHENTICATION_STRING'
          value: 'Authorization=AAD;ClientId=${identity.properties.clientId}'
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storage.properties.primaryEndpoints.blob
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: storage.properties.primaryEndpoints.queue
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: storage.properties.primaryEndpoints.table
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: identity.properties.clientId
        }
        {
          name: 'AzureFunctionsJobHost__extensions__durableTask__hubName'
          value: hubName
        }
        {
          name: 'SyncGameCount'
          value: '10'
        }
        {
          name: 'RankedSyncPages'
          value: '30'
        }
        {
          name: 'IdsPerPage'
          value: '1000'
        }
        {
          name: 'AzureWebJobs.GameSyncHttpStart.Disabled'
          value: 'true'
        }
        {
          name: 'AzureWebJobs.GameSyncHighSignalStart.Disabled'
          value: 'true'
        }
        {
          name: 'AzureWebJobs.GameSyncRankedStart.Disabled'
          value: 'true'
        }
        {
          name: 'AzureWebJobs.GameSyncTimerTriggerDev.Disabled'
          value: 'true'
        }
        {
          name: 'AzureWebJobs.GameSyncTimerTriggerProd.Disabled'
          value: 'true'
        }
      ]
    }
  }
  dependsOn: [
    blobAccess
    queueAccess
    tableAccess
    secretAccess
  ]
}

output functionAppId string = app.id
output storageAccountId string = storage.id
output taskHubName string = hubName
