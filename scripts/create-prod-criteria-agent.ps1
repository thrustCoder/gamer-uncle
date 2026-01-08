# Script to create a criteria extraction agent in production AI Foundry
# Uses a faster model (gpt-4o-mini) for criteria extraction

param(
    [switch]$ListOnly
)

$ErrorActionPreference = "Stop"

# Get Azure AD token
Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = az account get-access-token --resource "https://cognitiveservices.azure.com" --query accessToken -o tsv
if (-not $token) {
    Write-Error "Failed to get Azure AD token. Please run 'az login' first."
    exit 1
}

$baseUri = "https://gamer-uncle-prod-foundry-resourc.services.ai.azure.com/openai"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# List existing agents
Write-Host "`nListing existing agents..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$baseUri/assistants?api-version=2024-05-01-preview" -Headers $headers -Method GET
Write-Host "Found $($response.data.Count) agents:" -ForegroundColor Green
$response.data | ForEach-Object {
    Write-Host "  ID: $($_.id)" -ForegroundColor Yellow
    Write-Host "    Name: $($_.name)"
    Write-Host "    Model: $($_.model)"
}

if ($ListOnly) {
    exit 0
}

# Check if criteria agent already exists
$existingCriteriaAgent = $response.data | Where-Object { $_.name -like "*criteria*" -or $_.name -like "*Criteria*" }
if ($existingCriteriaAgent) {
    Write-Host "`nCriteria agent already exists:" -ForegroundColor Green
    Write-Host "  ID: $($existingCriteriaAgent.id)" -ForegroundColor Yellow
    Write-Host "  Name: $($existingCriteriaAgent.name)"
    Write-Host "  Model: $($existingCriteriaAgent.model)"
    Write-Host "`nUse this ID in appsettings.Production.json as CriteriaAgentId" -ForegroundColor Cyan
    exit 0
}

# Create new criteria agent with faster model
Write-Host "`nCreating criteria extraction agent with gpt-4o-mini model..." -ForegroundColor Cyan

$criteriaInstructions = @"
You are a specialized game criteria extraction assistant. Your ONLY job is to extract search criteria from user queries about board games.

IMPORTANT RULES:
1. ONLY extract criteria that are EXPLICITLY stated in the query
2. Return ONLY valid JSON with no additional text
3. If no criteria can be extracted, return: {"empty": true}
4. Do NOT infer or assume criteria that aren't mentioned

EXTRACTABLE CRITERIA:
- name: Game name (if specific game mentioned)
- minPlayers: Minimum player count
- maxPlayers: Maximum player count  
- minPlaytime: Minimum play time in minutes
- maxPlaytime: Maximum play time in minutes
- minWeight: Minimum complexity (1.0-5.0)
- maxWeight: Maximum complexity (1.0-5.0)
- mechanics: Array of game mechanics
- categories: Array of game categories

EXAMPLES:
Query: "games for 4 players"
Response: {"minPlayers": 4, "maxPlayers": 4}

Query: "quick games under 30 minutes"
Response: {"maxPlaytime": 30}

Query: "how do I win at Catan"
Response: {"empty": true}

Query: "recommend heavy strategy games for 2-4 players"
Response: {"minPlayers": 2, "maxPlayers": 4, "minWeight": 3.5}
"@

$body = @{
    model = "gpt-4o-mini"
    name = "Gamer Uncle Criteria Extractor (Fast)"
    instructions = $criteriaInstructions
    tools = @()
} | ConvertTo-Json -Depth 10

$newAgent = Invoke-RestMethod -Uri "$baseUri/assistants?api-version=2024-05-01-preview" -Headers $headers -Method POST -Body $body

Write-Host "`nCreated new criteria agent:" -ForegroundColor Green
Write-Host "  ID: $($newAgent.id)" -ForegroundColor Yellow
Write-Host "  Name: $($newAgent.name)"
Write-Host "  Model: $($newAgent.model)"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ACTION REQUIRED:" -ForegroundColor Yellow
Write-Host "Update appsettings.Production.json with:" -ForegroundColor Yellow
Write-Host "  CriteriaAgentId: $($newAgent.id)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
