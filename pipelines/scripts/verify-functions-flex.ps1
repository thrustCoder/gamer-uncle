param(
    [string]$AppName = $env:FUNCTIONS_TARGET_APP,
    [string]$SourceAppName = $env:FUNCTIONS_SOURCE_APP,
    [string]$ResourceGroup = $env:FUNCTIONS_RESOURCE_GROUP,
    [string]$ExpectedEnvironment = $env:FUNCTIONS_ENVIRONMENT,
    [string]$Approvers = $env:FUNCTIONS_MIGRATION_APPROVERS,
    [string]$MetadataPath = $env:FUNCTIONS_METADATA_PATH,
    [switch]$VerifyHost
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-AzureJson {
    param([string[]]$Arguments)

    $result = & az @Arguments --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI failed during Functions validation ($($Arguments[0]))."
    }
    return ($result -join "`n" | ConvertFrom-Json -AsHashtable)
}

if ($AppName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9-]{1,58}[a-zA-Z0-9]$' -or
    $AppName -eq $SourceAppName -or [string]::IsNullOrWhiteSpace($SourceAppName) -or
    [string]::IsNullOrWhiteSpace($ResourceGroup)) {
    throw 'An explicit replacement app and source resource group are required; source deployment is forbidden.'
}
if ($ExpectedEnvironment -notin @('Development', 'Production') -or
    [string]::IsNullOrWhiteSpace($Approvers) -or $Approvers -eq '__REQUIRED__') {
    throw 'Configure the expected environment and named migration approvers before opting in.'
}

$subscription = Invoke-AzureJson @('account', 'show', '--query', 'id')
if ($subscription -ne 'e1a26719-3504-42e4-bc8c-05aa63259e4b') {
    throw 'The service connection is not using the assessed migration subscription.'
}

$app = Invoke-AzureJson @('functionapp', 'show', '--name', $AppName, '--resource-group', $ResourceGroup)
$plan = Invoke-AzureJson @('appservice', 'plan', 'show', '--ids', $app.serverFarmId)
if ($plan.sku.name -ne 'FC1' -or $app.kind -notmatch 'linux' -or
    $app.functionAppConfig.runtime.name -ne 'dotnet-isolated' -or
    $app.functionAppConfig.runtime.version -ne '10.0' -or $app.state -ne 'Running') {
    throw 'The replacement must be a running Linux Flex Consumption app configured for .NET 10 isolated.'
}

$settingNames = @(Invoke-AzureJson @(
    'functionapp', 'config', 'appsettings', 'list', '--name', $AppName,
    '--resource-group', $ResourceGroup, '--query', "[?value != '' && value != ``null``].name"
))
foreach ($required in @(
    'COSMOS_ENDPOINT', 'COSMOS_DATABASE_NAME', 'COSMOS_CONTAINER_NAME',
    'AZURE_TENANT_ID', 'AZURE_CLIENT_ID'
)) {
    if ($required -notin $settingNames) {
        throw "Missing pre-provisioned replacement configuration: $required"
    }
}
if ('AzureWebJobsStorage' -notin $settingNames -and 'AzureWebJobsStorage__accountName' -notin $settingNames -and
    @('AzureWebJobsStorage__blobServiceUri', 'AzureWebJobsStorage__queueServiceUri',
      'AzureWebJobsStorage__tableServiceUri' | Where-Object { $_ -in $settingNames }).Count -ne 3) {
    throw 'Pre-provisioned host/Durable storage configuration is required.'
}

$hubSetting = 'AzureFunctionsJobHost__extensions__durableTask__hubName'
$starters = @(
    'GameSyncTimerTriggerDev', 'GameSyncTimerTriggerProd',
    'GameSyncHttpStart', 'GameSyncHighSignalStart', 'GameSyncRankedStart'
)
$selectedNames = @($hubSetting, 'AZURE_FUNCTIONS_ENVIRONMENT') +
    @($starters | ForEach-Object { "AzureWebJobs.$_.Disabled" })
$query = "[?$(($selectedNames | ForEach-Object { "name=='$_'" }) -join ' || ')].{name:name,value:value}"
$settings = @{}
foreach ($setting in @(Invoke-AzureJson @(
    'functionapp', 'config', 'appsettings', 'list', '--name', $AppName,
    '--resource-group', $ResourceGroup, '--query', $query
))) {
    $settings[$setting.name] = $setting.value
}
foreach ($starter in $starters) {
    if ($settings["AzureWebJobs.$starter.Disabled"] -ne 'true') {
        throw "Replacement starter $starter must remain disabled during deployment."
    }
}
if ($settings['AZURE_FUNCTIONS_ENVIRONMENT'] -ne $ExpectedEnvironment) {
    throw 'Replacement environment gating does not match the deployment environment.'
}

$sourceHub = Invoke-AzureJson @(
    'functionapp', 'config', 'appsettings', 'list', '--name', $SourceAppName,
    '--resource-group', $ResourceGroup, '--query', "[?name=='$hubSetting'].value | [0]"
)
if ([string]::IsNullOrWhiteSpace($sourceHub)) {
    $sourceHub = 'DurableFunctionsHub'
}
$targetHub = $settings[$hubSetting]
if ($targetHub -notmatch '^[a-zA-Z][a-zA-Z0-9]{2,44}$' -or
    $targetHub -eq $sourceHub -or $targetHub -eq 'DurableFunctionsHub') {
    throw 'A replacement-specific Durable task hub is required; source/default hub reuse is forbidden.'
}
Write-Host "Validated isolated .NET 10 Flex target $AppName; all starters remain disabled."

if (-not $VerifyHost) {
    return
}

$expected = @((Get-Content -LiteralPath $MetadataPath -Raw | ConvertFrom-Json).name)
if ($expected.Count -ne 13 -or @($expected | Sort-Object -Unique).Count -ne 13) {
    throw 'The validated artifact must contain all 13 unique function definitions.'
}
$hostname = $app.defaultHostName
if ($hostname -notmatch '^[a-zA-Z0-9.-]+\.azurewebsites\.net$') {
    throw 'The Azure-reported replacement hostname is invalid.'
}

# Host status requires the admin key; never print it or invoke a sync starter.
$hostKey = Invoke-AzureJson @(
    'functionapp', 'keys', 'list', '--name', $AppName,
    '--resource-group', $ResourceGroup, '--query', 'masterKey'
)
if ([string]::IsNullOrWhiteSpace($hostKey)) {
    throw 'Unable to authenticate the host readiness probe.'
}

$maxAttempts = 10
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $status = $null
    try {
        $status = Invoke-RestMethod -Uri "https://$hostname/admin/host/status" `
            -Headers @{ 'x-functions-key' = $hostKey } -TimeoutSec 30 -MaximumRedirection 0
    }
    catch [System.Net.Http.HttpRequestException],
          [Microsoft.PowerShell.Commands.HttpResponseException],
          [System.Threading.Tasks.TaskCanceledException] {
        Write-Warning "Host status probe failed on attempt $attempt of $maxAttempts ($($_.Exception.GetType().Name))."
    }

    if ($null -ne $status -and $status.state -eq 'Running') {
        $functions = @(Invoke-AzureJson @(
            'functionapp', 'function', 'list', '--name', $AppName,
            '--resource-group', $ResourceGroup, '--query', '[].name'
        ))
        $actual = @($functions | ForEach-Object { ($_ -split '/')[-1] })
        if ($actual.Count -eq $expected.Count -and
            -not @(Compare-Object $expected $actual -CaseSensitive).Count) {
            Write-Host 'Functions host is Running and all 13 artifact functions are discovered.'
            Write-Host 'This is readiness evidence only; workflow/data verification and scheduling require separate approval.'
            return
        }
        Write-Warning "Function discovery is incomplete or differs from the artifact (attempt $attempt)."
    }
    else {
        Write-Warning "Functions host is not Running (attempt $attempt)."
    }
    if ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 20
    }
}
throw "Functions host readiness/discovery did not pass within $maxAttempts attempts."
