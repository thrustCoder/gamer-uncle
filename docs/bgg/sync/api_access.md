# BGG XML API Access — Findings & Next Steps

## Status: BLOCKED — API Now Requires Authentication

**Date Discovered:** 2026-02-17  
**Affected Components:** `BggRankedListClient.cs`, `BggApiClient.cs` (all BGG XML API calls)

---

## Problem Summary

BoardGameGeek's XML API (`xmlapi2/thing`, `xmlapi2/collection`, etc.) now requires **app registration + Bearer token** for all requests. Previously unauthenticated calls now return **HTTP 401 Unauthorized**.

This affects:
- **Ranked Sync** (`BggRankedListClient`) — new feature, never worked in prod
- **Game Fetch** (`BggApiClient`) — existing feature, **will break on next sync run** if not already broken

## Evidence

```
# Both URLs return 401 Unauthorized:
GET https://www.boardgamegeek.com/xmlapi2/thing?id=204135&stats=1  → 401
GET https://boardgamegeek.com/xmlapi2/thing?id=204135&stats=1      → 401

# App Insights (instance 105e1a863a5d47d1aeaf435aa63a0a5a):
# 43 activities started, 21 failed with 401, 0 succeeded
```

---

## BGG API Policy Summary

Source: https://boardgamegeek.com/using_the_xml_api (Version 2025-07-02)

### Registration Required
- Register at https://boardgamegeek.com/applications → click "Create Application"
- Choose **Commercial** or **Non-commercial** license type
- Approval may take **a week or more**
- **Exceptions** (registration NOT required):
  - Downloading your own collection while logged in
  - Downloading other users' collections while logged in (but heavily rate-limited without registration)
  - Downloading the CSV dump of all games while logged in
- **License denial criteria**: BGG may deny apps that compete with any part of BGG's business or harm BGG in any way. Convention ticketing apps are specifically called out as likely to be declined.

### Authentication
- Bearer token via `Authorization: Bearer <token>` header
- Token created after app approval at https://boardgamegeek.com/applications → Tokens
- **Domain must be `boardgamegeek.com`** (without `www.`) — our code currently uses `www.boardgamegeek.com`
- Token format: UUID (e.g., `e3f8c3ff-9926-4efc-863c-3b92acda4d32`)
- **Token refresh**: Currently Bearer tokens do **not** require refresh, but BGG states this may change
- If you cannot add the Authorization header, you cannot use the XML API

### License Types

| Type | Criteria | Cost |
|------|----------|------|
| Non-commercial | No ads, no payments, no fundraising | Free |
| Commercial (user payments) | Monetized via user payments | Free until 100 paying users |
| Commercial (ads) | Monetized via ads | Free until 1,000 users |
| Commercial (sales/stores) | Online game stores | Paid immediately |
| Commercial (donations) | Voluntary donations only | Free |

**Gamer Uncle is non-commercial** → should qualify for a **free non-commercial license**.

### Usage Limits
- Requests should come from **server-side** (not client), with results cached — BGG explicitly warns that client-side requests (browser/app) may generate too much traffic and lead to license suspension
- Keep request count to a minimum
- Limits vary by license type (exact numbers not published)
- Usage can be monitored at https://boardgamegeek.com/applications → click "Usage" under your app name
- **Our compliance**: All BGG requests are server-side (Azure Functions), results cached in Cosmos DB. No client-side BGG calls from the mobile app.

### Terms of Use Highlights
Source: https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use

- **License grant**: Worldwide, non-exclusive, royalty-free license to reproduce and display data
- **Non-commercial only** (for non-commercial license): Strictly non-commercial purposes
- **Termination**: BGG can terminate access at any time for any reason
- **No guarantee**: Data provided as-is, no uptime guarantees
- **Attribution required**: Public-facing apps must include "Powered by BGG" logo linking back to BGG
  - Logo files: https://drive.google.com/drive/folders/1k3VgEIpNEY59iTVnpTibt31JcO0rEaSw

### Technical Requirements
- Use HTTPS only
- Use `boardgamegeek.com` domain (not `www.boardgamegeek.com`)
- Authorization header: `Authorization: Bearer <token>` — "Bearer" followed by a space (no colon)
- No technical support — use [Geek Tools Guild](https://boardgamegeek.com/guild/1229) for questions
- Planned changes announced in [Geek Tools News forum](https://boardgamegeek.com/forum/1182517/geek-tools/news)
- Private APIs (non-XML, used by BGG website) are **not licensed** for external use
- This agreement also applies to downloading user collections in XML/CSV format

### CSV Dump Alternative
- BGG offers a **CSV download of all games** (see [BGG_XML_API2](https://boardgamegeek.com/wiki/page/BGG_XML_API2) page)
- Available to approved applications — can be downloaded directly from the page while logged in, or via the Application Token
- **Potential use**: Could supplement or reduce XML API calls for bulk game data seeding

---

## Current State (Prod DB)

- **3,626 games** in prod Cosmos DB (`Games` container, ~15 MB)
- Games synced from BGG IDs 1–500 (sequential scan, `SyncGameCount=500`)
- Quality-filtered games only (min votes, min rating thresholds)
- Missing high-ID games like Skyjo (204,135) and Plunder: A Pirate's Life (281,094)
- **Timer triggers DISABLED** in `DurableGameUpsertFunction.cs` — both dev and prod ranked sync triggers return early with a warning log to prevent 401 errors

---

## Next Steps

### Immediate (No Code Changes)
1. **Register app on BGG**: Go to https://boardgamegeek.com/applications → Create Application
   - **App name**: "Gamer Uncle"
   - **Type**: Non-commercial
   - **Suggested description**:
     > AI-powered board game recommendation assistant. Server-side only — Azure Functions periodically fetch game metadata from the XML API to populate a database used for offline recommendations. No client-side BGG requests. No monetization, ads, or payments.
   - Wait for approval (up to 1+ weeks)

2. **Generate Bearer token** after approval:
   - Go to https://boardgamegeek.com/applications → Tokens → Create Token
   - Store token securely (Azure Key Vault: `BggApiBearerToken`)
   - Token format is a UUID, e.g., `e3f8c3ff-9926-4efc-863c-3b92acda4d32`

### Code Changes (After Token Obtained)
3. **Add Bearer token to both API clients**:
   - `BggApiClient.cs`: Add `Authorization: Bearer <token>` header
   - `BggRankedListClient.cs`: Add `Authorization: Bearer <token>` header
   - Read token from environment variable `BggApiBearerToken`
   - Store in Key Vault for both dev and prod function apps

4. **Fix API domain**: Change `www.boardgamegeek.com` → `boardgamegeek.com` in both clients

5. **Add "Powered by BGG" attribution**: Required for public-facing apps
   - Add logo + link to BGG in mobile app (e.g., settings screen or recommendation card footer)
   - Logo must be sized so text remains easily legible
   - Logo files: https://drive.google.com/drive/folders/1k3VgEIpNEY59iTVnpTibt31JcO0rEaSw

6. **Re-enable timer triggers** in `DurableGameUpsertFunction.cs` (remove early-return guards)

7. **Re-trigger ranked sync** after code deployed with valid token

8. **(Optional) Evaluate CSV dump**: After approval, check if the BGG CSV dump of all games could reduce our XML API call volume for initial seeding

### Configuration (Azure)
```powershell
# After obtaining token, store in Key Vault:
az keyvault secret set --vault-name "gamer-uncle-dev-vault" --name "BggApiBearerToken" --value "<token>"
az keyvault secret set --vault-name "gamer-uncle-prod-vault" --name "BggApiBearerToken" --value "<token>"

# Add app setting to function apps (Key Vault reference):
az functionapp config appsettings set --name "gamer-uncle-dev-function" --resource-group "gamer-uncle-dev-rg" \
  --settings "BggApiBearerToken=@Microsoft.KeyVault(SecretUri=https://gamer-uncle-dev-vault.vault.azure.net/secrets/BggApiBearerToken)"
az functionapp config appsettings set --name "gamer-uncle-prod-function" --resource-group "gamer-uncle-prod-rg" \
  --settings "BggApiBearerToken=@Microsoft.KeyVault(SecretUri=https://gamer-uncle-prod-vault.vault.azure.net/secrets/BggApiBearerToken)"
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| BGG denies registration | No API access at all | App is non-commercial, no competition with BGG — should qualify |
| Long approval wait | Delayed sync feature | Existing 3,626 games sufficient short-term |
| Token expiration / refresh policy changes | Sync breaks silently | Monitor via App Insights alerts; BGG may require token refresh in future |
| Rate limits too low | Slow sync | Already have backoff/retry; reduce batch frequency; consider CSV dump for bulk seeding |
| BGG changes API again | Breaking changes | Monitor [Geek Tools News forum](https://boardgamegeek.com/forum/1182517/geek-tools/news) |
| License revoked | API access lost | Ensure compliance: server-side only, proper attribution, non-commercial use |
