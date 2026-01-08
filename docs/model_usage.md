# Model & Agent Usage Inventory

> **Last Updated**: January 8, 2026 (Dev updated to use gpt-4.1-mini)

This document provides an inventory of all Azure AI models and agents used across development and production environments.

---

## Summary

| Environment | Model Deployments | AI Agents |
|-------------|-------------------|-----------|
| Development | 2 | 2 |
| Production | 3 | 2 |

---

## Development Environment

**Resource Group**: `gamer-uncle-dev-rg`  
**AI Services Account**: `gamer-uncle-dev-foundry`  
**Foundry Project**: `gamer-uncle-dev-foundry-project`

### Model Deployments

| Deployment Name | Model | Version | Purpose |
|-----------------|-------|---------|---------|
| `gpt-4.1` | gpt-4.1 | 2025-04-14 | Main model for response generation |
| `gpt-4.1-mini` | gpt-4.1-mini | 2025-04-14 | Fast criteria extraction (A3 optimization) |

### AI Agents

| Agent ID | Name | Model | Purpose |
|----------|------|-------|---------|
| `asst_I9OYA4pzbMEmjzz84Vo5z4Zm` | gamer-uncle-dev-agent | gpt-4.1 | **Response Agent** - Main conversational agent for game recommendations |
| `asst_ecURMFeOra3Yz5RXWiHMgPFn` | gamer-uncle-dev-criteria-agent | gpt-4.1-mini | **Criteria Agent** - Extracts search criteria from user queries (A3 optimization) |

> **Cleanup Note**: Agent `asst_opExT22aV38EAlL689mEZ6Vc` (gamer-uncle-criteria-fast) still exists but is no longer in use. Can be deleted via Azure AI Foundry portal.

---

## Production Environment

**Resource Group**: `gamer-uncle-prod-rg`  
**AI Services Account**: `gamer-uncle-prod-foundry-resourc`  
**Foundry Project**: `gamer-uncle-prod-foundry-project`

### Model Deployments

| Deployment Name | Model | Version | Purpose |
|-----------------|-------|---------|---------|
| `gpt-4.1` | gpt-4.1 | 2025-04-14 | High-quality response generation |
| `gpt-4.1-mini` | gpt-4.1-mini | 2025-04-14 | Fast criteria extraction (A3 optimization) |
| `gpt-realtime` | gpt-realtime | 2025-08-28 | WebRTC voice conversations |

### AI Agents

| Agent ID | Name | Model | Purpose |
|----------|------|-------|---------|
| `asst_vzwvCm0X0cfZmGWUENbFXseg` | gamer-uncle-prod-agent | gpt-4.1 | **Response Agent** - Main conversational agent for game recommendations |
| `asst_JlZKaVrDTN5BTHjoS87mdVqJ` | gamer-uncle-prod-criteria-agent | gpt-4.1-mini | **Criteria Agent** - Extracts search criteria from user queries (A3 optimization) |

---

## Configuration Reference

### App Service Settings

| Setting | Dev Value | Prod Value |
|---------|-----------|------------|
| `AgentService__AgentId` | `asst_I9OYA4pzbMEmjzz84Vo5z4Zm` | `asst_vzwvCm0X0cfZmGWUENbFXseg` |
| `AgentService__CriteriaAgentId` | `asst_ecURMFeOra3Yz5RXWiHMgPFn` | `asst_JlZKaVrDTN5BTHjoS87mdVqJ` |
| `AgentService__ResponseAgentId` | `asst_I9OYA4pzbMEmjzz84Vo5z4Zm` | `asst_vzwvCm0X0cfZmGWUENbFXseg` |

### appsettings Files

- **Dev**: `services/api/appsettings.Development.json`
- **Prod**: `services/api/appsettings.Production.json`

---

## Usage Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Text Chat Flow                           │
├─────────────────────────────────────────────────────────────────┤
│  User Query                                                     │
│      ↓                                                          │
│  Criteria Agent (gpt-4.1-mini)  ← Fast JSON extraction          │
│      ↓                                                          │
│  Cosmos DB Query (if criteria found)                            │
│      ↓                                                          │
│  Response Agent (gpt-4.1)  ← High-quality recommendations       │
│      ↓                                                          │
│  Response to User                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      WebRTC Voice Flow                          │
├─────────────────────────────────────────────────────────────────┤
│  User Voice Input                                               │
│      ↓                                                          │
│  gpt-realtime model (WebSocket connection)                      │
│      ↓                                                          │
│  Real-time voice response                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Notes

1. **A3 Optimization**: Both dev and production now use `gpt-4.1-mini` for criteria extraction, saving 1-2 seconds per query.

2. **WebRTC Voice**: Uses model deployment directly (`gpt-realtime`), not an AI agent. Only available in production.

3. **Cost Considerations**: `gpt-4.1-mini` is cheaper and faster than `gpt-4.1` for simple tasks like JSON extraction.

4. **Manual Cleanup**: Old agent `asst_opExT22aV38EAlL689mEZ6Vc` in dev can be deleted via the Azure AI Foundry portal under the project's Agents section.
