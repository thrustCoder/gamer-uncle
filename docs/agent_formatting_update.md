# Agent Instructions Update: Emojis & Structured Formatting

> **Created**: January 9, 2026  
> **Purpose**: Update AI agent system prompts to include emojis and structured markdown formatting  
> **Phase**: Dev first, then Prod after testing

---

## Overview

The TTS sanitization has been implemented in code ([TtsTextSanitizer.cs](../services/api/Services/Speech/TtsTextSanitizer.cs)). 
Now we need to update the agent instructions in Azure AI Foundry to generate responses with:
- 🎲 Emojis for visual appeal
- **Bold**, *italic*, and structured formatting for readability
- Bullet points and numbered lists for clarity

The TTS service will automatically strip these for spoken audio while chat displays them.

---

## Phase 1: Development Environment

### Agent to Update
| Field | Value |
|-------|-------|
| Portal | [Azure AI Foundry](https://ai.azure.com) |
| Project | `gamer-uncle-dev-foundry-project` |
| Agent Name | `gamer-uncle-dev-agent` |
| Agent ID | `asst_I9OYA4pzbMEmjzz84Vo5z4Zm` |

### Instructions to ADD to the Agent's System Prompt

Add the following section at the END of the existing instructions (do NOT replace existing instructions):

```
## Response Formatting Guidelines

Format your responses for visual appeal and readability:

### Emojis
Use relevant emojis sparingly to add warmth and visual interest:
- 🎲 for dice/random mechanics
- 🎮 for gaming in general
- 🌟 for highlighting recommendations
- ⏱️ for play time
- 👥 for player count
- 🏆 for awards or top picks
- 💡 for tips and insights
- ✅ for confirmed/good matches
- 📖 for rules explanations

### Structured Formatting
Use markdown formatting for clarity:
- **Bold** for game names and key terms
- *Italic* for emphasis
- Bullet points for lists of features or games
- Numbered lists for step-by-step instructions or ranked recommendations

### Example Response Style
Instead of:
"Catan is a great game for 3-4 players that takes about 60 minutes."

Write:
"🌟 **Catan** is a fantastic choice!

- 👥 **Players**: 3-4 (best with 4)
- ⏱️ **Play Time**: 60-90 minutes
- 💡 **Why it works**: Easy to learn, great social interaction"

Keep responses conversational and warm while using formatting to enhance readability.
```

### Steps to Update in Azure AI Foundry

1. Go to [Azure AI Foundry](https://ai.azure.com)
2. Select project: **gamer-uncle-dev-foundry-project**
3. Navigate to: **Agents** → **gamer-uncle-dev-agent**
4. Click **Edit** or open agent settings
5. Find the **Instructions** field (system prompt)
6. Add the formatting guidelines section above to the END of existing instructions
7. Click **Save**

---

## Verification: Dev Environment

After updating the agent, test with these queries:

### Test 1: Game Recommendation
```
What's a good game for 4 players that takes about an hour?
```
**Expected**: Response includes emojis (🎲, 🌟, etc.) and bold game names

### Test 2: Rules Explanation
```
How do you play Catan?
```
**Expected**: Response uses bullet points or numbered steps

### Test 3: Voice Chat (TTS Test)
Use the mobile app voice feature to ask:
```
Recommend a party game
```
**Expected**: 
- Chat displays emojis and formatting
- Voice audio speaks clean text without emoji sounds

### Verification Script

Run this after updating the agent:

```powershell
# Test Dev API for emoji/formatting response
$body = @{
    query = "What's a good game for beginners?"
    conversationId = "test-emoji-" + (Get-Date -Format "yyyyMMddHHmmss")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://gamer-uncle-dev-app-svc.azurewebsites.net/api/recommendations" `
    -Method POST -Body $body -ContentType "application/json"

# Check for emojis and formatting
$hasEmoji = $response.response -match "[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]"
$hasBold = $response.response -match "\*\*[^*]+\*\*"
$hasBullets = $response.response -match "^[\s]*[-*][\s]" 

Write-Host "Response Preview:" -ForegroundColor Yellow
Write-Host ($response.response.Substring(0, [Math]::Min(500, $response.response.Length))) -ForegroundColor Cyan
Write-Host ""
Write-Host "Validation Results:" -ForegroundColor Yellow
Write-Host "  Has Emojis: $hasEmoji" -ForegroundColor $(if($hasEmoji){"Green"}else{"Red"})
Write-Host "  Has Bold Text: $hasBold" -ForegroundColor $(if($hasBold){"Green"}else{"Red"})
Write-Host "  Has Bullets: $hasBullets" -ForegroundColor $(if($hasBullets){"Green"}else{"Red"})
```

---

## Phase 2: Production Environment (After Dev Validation)

### Agent to Update
| Field | Value |
|-------|-------|
| Portal | [Azure AI Foundry](https://ai.azure.com) |
| Project | `gamer-uncle-prod-foundry-project` |
| Agent Name | `gamer-uncle-prod-agent` |
| Agent ID | `asst_vzwvCm0X0cfZmGWUENbFXseg` |

### Steps
1. Ensure Dev testing is complete and approved
2. Follow the same steps as Phase 1 for the production agent
3. Run the verification script against production URL

### Production Verification Script

```powershell
# Test Prod API for emoji/formatting response
$body = @{
    query = "What's a good game for beginners?"
    conversationId = "test-emoji-prod-" + (Get-Date -Format "yyyyMMddHHmmss")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://gamer-uncle-prod-app-svc.azurewebsites.net/api/recommendations" `
    -Method POST -Body $body -ContentType "application/json"

# Check for emojis and formatting
$hasEmoji = $response.response -match "[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]"
$hasBold = $response.response -match "\*\*[^*]+\*\*"

Write-Host "Production Response Preview:" -ForegroundColor Yellow
Write-Host ($response.response.Substring(0, [Math]::Min(500, $response.response.Length))) -ForegroundColor Cyan
Write-Host ""
Write-Host "Has Emojis: $hasEmoji | Has Bold: $hasBold"
```

---

## Rollback Plan

If issues are found:
1. Go to Azure AI Foundry
2. Edit the agent's instructions
3. Remove the "Response Formatting Guidelines" section
4. Save

No code changes needed - the TTS sanitizer gracefully handles plain text.

---

## Checklist

### Phase 1: Development
- [ ] Update `gamer-uncle-dev-agent` instructions in Azure AI Foundry
- [ ] Test chat responses show emojis and formatting
- [ ] Test voice responses speak clean text (no emoji sounds)
- [ ] Run verification script
- [ ] Get approval to proceed to Phase 2

### Phase 2: Production
- [ ] Update `gamer-uncle-prod-agent` instructions in Azure AI Foundry
- [ ] Test production chat responses
- [ ] Test production voice responses
- [ ] Run production verification script
- [ ] Monitor for user feedback
