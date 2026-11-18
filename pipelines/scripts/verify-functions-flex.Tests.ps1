$ErrorActionPreference = 'Stop'
$WarningPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$flexTestScenario = ''
$flexTestStarters = @(
    'GameSyncTimerTriggerDev', 'GameSyncTimerTriggerProd',
    'GameSyncHttpStart', 'GameSyncHighSignalStart', 'GameSyncRankedStart'
)
$flexTestMetadata = @(
    'DurableGameUpsertOrchestrator', 'FetchGameDataActivity', 'CheckGameExistsActivity',
    'UpsertGameDocumentActivity', 'GameSyncHttpStart', 'GameSyncTimerTriggerDev',
    'GameSyncTimerTriggerProd', 'DurableHighSignalUpsertOrchestrator',
    'HighSignalChunkOrchestrator', 'GameSyncHighSignalStart',
    'DurableRankedSyncOrchestrator', 'FetchRankedGameIdsActivity', 'GameSyncRankedStart'
) | ForEach-Object { @{ name = $_ } }

# These mocks are scoped to this test script; no Azure or HTTP operations are performed.
function az {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    $global:LASTEXITCODE = 0
    if ($flexTestScenario -eq 'cli-error') {
        $global:LASTEXITCODE = 1
        return
    }
    if ($Arguments[0] -eq 'account') {
        $value = if ($flexTestScenario -eq 'wrong-subscription') { 'different-subscription' }
            else { 'e1a26719-3504-42e4-bc8c-05aa63259e4b' }
    }
    elseif ($Arguments[0] -eq 'appservice') {
        $value = @{ sku = @{ name = if ($flexTestScenario -eq 'legacy-plan') { 'Y1' } else { 'FC1' } } }
    }
    elseif ($Arguments[1] -eq 'show') {
        $value = @{
            serverFarmId = '/mock-plan'
            kind = if ($flexTestScenario -eq 'windows') { 'functionapp' } else { 'functionapp,linux' }
            state = if ($flexTestScenario -eq 'stopped') { 'Stopped' } else { 'Running' }
            functionAppConfig = @{ runtime = @{
                name = 'dotnet-isolated'
                version = if ($flexTestScenario -eq 'wrong-runtime') { '8.0' } else { '10.0' }
            } }
            defaultHostName = if ($flexTestScenario -eq 'invalid-hostname') {
                'unexpected.example.invalid'
            } else { 'replacement.azurewebsites.net' }
        }
    }
    elseif ($Arguments[1] -eq 'keys') {
        $value = if ($flexTestScenario -eq 'missing-key') { '' } else { 'mock-host-key' }
    }
    elseif ($Arguments[1] -eq 'function') {
        $value = @($flexTestMetadata.name)
        if ($flexTestScenario -eq 'missing-function') { $value = $value[1..12] }
        if ($flexTestScenario -eq 'wrong-function-case') { $value[0] = $value[0].ToLowerInvariant() }
    }
    elseif ($Arguments -contains 'appsettings') {
        $query = $Arguments[[Array]::IndexOf($Arguments, '--query') + 1]
        if ($query.StartsWith('[?value')) {
            $value = @('COSMOS_ENDPOINT', 'COSMOS_DATABASE_NAME', 'COSMOS_CONTAINER_NAME',
                'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AzureWebJobsStorage__accountName')
            if ($flexTestScenario -eq 'missing-config') { $value = $value | Where-Object { $_ -ne 'COSMOS_ENDPOINT' } }
            if ($flexTestScenario -eq 'missing-storage') { $value = $value | Where-Object { $_ -notlike 'AzureWebJobsStorage*' } }
            if ($flexTestScenario -eq 'storage-credential-only') {
                $value = @($value | Where-Object { $_ -notlike 'AzureWebJobsStorage*' }) +
                    'AzureWebJobsStorage__credential'
            }
            if ($flexTestScenario -eq 'explicit-storage-uris') {
                $value = @($value | Where-Object { $_ -notlike 'AzureWebJobsStorage*' }) +
                    @('AzureWebJobsStorage__blobServiceUri', 'AzureWebJobsStorage__queueServiceUri',
                      'AzureWebJobsStorage__tableServiceUri')
            }
        }
        elseif ($query.Contains('| [0]')) {
            $value = if ($flexTestScenario -eq 'reused-hub') { 'ReplacementHub10' } else { $null }
        }
        else {
            $value = @(
                @{ name = 'AzureFunctionsJobHost__extensions__durableTask__hubName'
                   value = if ($flexTestScenario -eq 'default-hub') { 'DurableFunctionsHub' } else { 'ReplacementHub10' } },
                @{ name = 'AZURE_FUNCTIONS_ENVIRONMENT'
                   value = if ($flexTestScenario -eq 'wrong-environment') { 'Production' } else { 'Development' } }
            ) + @($flexTestStarters | ForEach-Object {
                @{ name = "AzureWebJobs.$_.Disabled"; value = if ($flexTestScenario -eq "enabled-$_") { 'false' } else { 'true' } }
            })
        }
    }
    else {
        throw "Unexpected mocked Azure command: $($Arguments[0..1] -join ' ')"
    }
    ConvertTo-Json -InputObject $value -Depth 10 -Compress
}

function Invoke-RestMethod {
    param([string]$Uri, [hashtable]$Headers, [int]$TimeoutSec, [int]$MaximumRedirection)

    if ($Uri -ne 'https://replacement.azurewebsites.net/admin/host/status' -or
        $Headers['x-functions-key'] -ne 'mock-host-key') {
        throw 'Unexpected host probe target or authentication.'
    }
    if ($flexTestScenario -eq 'host-http-error') {
        throw [System.Net.Http.HttpRequestException]::new('Simulated HTTP 503.')
    }
    return @{ state = if ($flexTestScenario -eq 'host-error') { 'Error' } else { 'Running' } }
}

function Start-Sleep {
    param([int]$Seconds)
}

$metadataPath = [System.IO.Path]::GetTempFileName()
try {
    $flexTestMetadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath
    $cases = @(
        @{ name = 'valid'; passes = $true },
        @{ name = 'explicit-storage-uris'; passes = $true },
        @{ name = 'invalid-target'; error = 'explicit replacement' },
        @{ name = 'source-target'; error = 'source deployment is forbidden' },
        @{ name = 'missing-approvers'; error = 'named migration approvers' },
        @{ name = 'wrong-subscription'; error = 'assessed migration subscription' },
        @{ name = 'legacy-plan'; error = 'Linux Flex Consumption' },
        @{ name = 'windows'; error = 'Linux Flex Consumption' },
        @{ name = 'wrong-runtime'; error = 'Linux Flex Consumption' },
        @{ name = 'stopped'; error = 'Linux Flex Consumption' },
        @{ name = 'missing-config'; error = 'Missing pre-provisioned' },
        @{ name = 'missing-storage'; error = 'storage configuration is required' },
        @{ name = 'storage-credential-only'; error = 'storage configuration is required' },
        @{ name = 'wrong-environment'; error = 'environment gating' },
        @{ name = 'reused-hub'; error = 'hub reuse is forbidden' },
        @{ name = 'default-hub'; error = 'hub reuse is forbidden' },
        @{ name = 'cli-error'; error = 'Azure CLI failed' },
        @{ name = 'valid-host'; passes = $true; hostCheck = $true },
        @{ name = 'invalid-hostname'; error = 'hostname is invalid'; hostCheck = $true },
        @{ name = 'missing-key'; error = 'authenticate the host'; hostCheck = $true },
        @{ name = 'host-error'; error = 'did not pass'; hostCheck = $true },
        @{ name = 'host-http-error'; error = 'did not pass'; hostCheck = $true },
        @{ name = 'missing-function'; error = 'did not pass'; hostCheck = $true },
        @{ name = 'wrong-function-case'; error = 'did not pass'; hostCheck = $true }
    ) + @($flexTestStarters | ForEach-Object { @{ name = "enabled-$_"; error = 'must remain disabled' } })
    foreach ($case in $cases) {
        $flexTestScenario = $case.name
        $options = @{
            AppName = 'replacement-app'
            SourceAppName = 'source-app'
            ResourceGroup = 'mock-rg'
            ExpectedEnvironment = 'Development'
            Approvers = 'migration-reviewers'
            MetadataPath = $metadataPath
            VerifyHost = $case['hostCheck'] -eq $true
        }
        if ($case.name -eq 'invalid-target') { $options.AppName = '__REQUIRED__' }
        if ($case.name -eq 'source-target') { $options.AppName = 'source-app' }
        if ($case.name -eq 'missing-approvers') { $options.Approvers = '__REQUIRED__' }
        try {
            & (Join-Path $PSScriptRoot 'verify-functions-flex.ps1') @options *> $null
            if (-not $case['passes']) { throw 'Expected rejection but validation succeeded.' }
        }
        catch {
            if ($case['passes'] -or $_.Exception.Message -notlike "*$($case.error)*") {
                throw "Scenario '$($case.name)' failed: $($_.Exception.Message)"
            }
        }
        Write-Host "Passed Functions validation scenario: $($case.name)"
    }
    Write-Host "Passed all $($cases.Count) mocked Functions deployment validation scenarios."
}
finally {
    Remove-Item -LiteralPath $metadataPath
}
