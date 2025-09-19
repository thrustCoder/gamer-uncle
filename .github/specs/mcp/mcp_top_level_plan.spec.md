<!-- Source: GitHub Issue #75 "MCP integration plan" (opened Aug 14, 2025 by @thrustCoder) -->

# MCP Integration Plan

This document is an extracted, workspace-local copy of the original issue plan so it can be iterated on alongside code. Keep this file as the living design; update the issue with major deltas when milestones are reached.

---

## Target Architecture

```
iOS app → Azure Front Door (Premium, custom domain + WAF) → Private Link → App Service (hosts /mcp/* + /api/*)
```

Paths:
* `/mcp/*` → Protected (Easy Auth enforced + edge hardened + header gate)
* `/api/*` → Temporarily excluded from Easy Auth (still WAF + AFD protected) until mobile login ships
* Origin (App Service) not publicly reachable; AFD is the only ingress

Key security layers (defense in depth):
1. AFD + WAF (bot mgr, managed rules, custom rules)
2. Private Link to origin
3. Header gate (`X-AFD-Gate`) proving traversal via AFD
4. Easy Auth (Entra ID) on MCP surface
5. Application rate limiting / future per-user auth

---

## Phase 0 — Naming & Prerequisites

| Resource | Name (proposed) |
|----------|-----------------|
| Resource Group | `gamer-uncle-prod-rg` |
| App Service Plan | `gamer-uncle-asp` |
| App Service | `gamer-uncle-api` |
| AFD Premium Profile | `gamer-uncle-afd` |
| AFD Endpoint / Custom Domain | `api.gameruncle.com` |
| WAF Policy | `gamer-uncle-waf` |
| AFD Origin Group | `gamer-uncle-orig` |

---

## Phase 1 — App Service (Host Both Surfaces)

Deploy existing mobile API routes under `/api/*` and MCP endpoints under `/mcp/*` within the same App Service.

### Header Gate Middleware (Defense in Depth)

Add a header gate only for `/mcp/*` requests to ensure traffic passed through AFD:

```csharp
app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/mcp"), mcp =>
{
	mcp.Use(async (ctx, next) =>
	{
		var secret = ctx.Request.Headers["X-AFD-Gate"].FirstOrDefault();
		if (secret != Environment.GetEnvironmentVariable("AFD_GATE_SECRET"))
		{
			ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
			await ctx.Response.WriteAsync("Forbidden");
			return;
		}
		await next();
	});

	// Map MCP endpoints here
});
```

App Setting required:
* `AFD_GATE_SECRET=<random-guid>`

---

## Phase 2 — Easy Auth (Authentication) With Path Exclusion

1. Enable Authentication (App Service → Authentication)
2. Provider: Microsoft Entra ID
3. Unauthenticated requests: Require authentication (401)
4. Excluded paths (initial): `/api/*`
5. Do NOT exclude: `/mcp/*`

### Token Audience Setup

Create two Entra applications:
* API (resource): `GamerUncle-API` — expose an Application ID URI (`api://<api-app-id>`)
* MCP client: `GamerUncle-MCP-Client` — client credentials flow

Allowed token audiences (App Service auth config): `api://<api-app-id>`

Result: `/mcp/*` requires a valid token; `/api/*` remains anonymous until mobile login is introduced.

---

## Phase 3 — AFD Premium + WAF

1. Create AFD Premium profile & endpoint
2. Add custom domain `api.gameruncle.com` (managed TLS)
3. Attach WAF policy in Prevention (block) mode
4. WAF Policies:
   * Managed: Latest DRS + Bot Manager
   * Custom ordered rules (example):
	 a. If path starts with `/mcp/` AND missing `Authorization` header → Block
	 b. Rate limit `/mcp/*` (e.g., 60 req/min/IP, tune later)
	 c. Enforce size limits (URL length, body size) for `/mcp/*`
	 d. (Optional) Geo allow/deny
5. Send diagnostic logs to Log Analytics; alert on rate-limit spikes & high severity blocks

---

## Phase 4 — AFD Origins, Routes, Private Link

1. Add origin group + App Service origin
2. Enable Private Link; approve the private endpoint on App Service side
3. Disable public network access / add access restrictions to block direct hits
4. Routes:
   * Route A: `/*` → origin group (default)
   * (Optional) Route B: `/mcp/*` (future route-specific controls)
5. Configure origin request header injection:
   * `X-AFD-Gate: <AFD_GATE_SECRET>`

---

## Phase 5 — Call Flows

### MCP (Server → Server)

1. MCP client obtains token (client credentials) for scope `api://<api-app-id>/.default`
2. Calls `https://api.gameruncle.com/mcp/<endpoint>` with `Authorization: Bearer <token>`
3. AFD injects `X-AFD-Gate`; origin validates header + Easy Auth principal

Code sketch:
```csharp
var cca = ConfidentialClientApplicationBuilder
	.Create("<mcp-client-app-id>")
	.WithClientSecret("<secret>")
	.WithAuthority("https://login.microsoftonline.com/<tenant>")
	.Build();

var token = await cca
	.AcquireTokenForClient(new[] { "api://<api-app-id>/.default" })
	.ExecuteAsync();

var req = new HttpRequestMessage(HttpMethod.Post, "https://api.gameruncle.com/mcp/tool");
req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
var resp = await new HttpClient().SendAsync(req);
```

### Mobile (iOS) (Initial State)

* Calls `https://api.gameruncle.com/api/*` without auth
* Still protected by WAF + rate limiting at edge
* Will later transition to authenticated once login is implemented

---

## Phase 6 — CORS, Health, Timeouts

* Add health probe endpoint: `GET /healthz` (exclude or relax strict WAF rules if needed)
* Configure CORS only if true cross-origin (e.g., WebViews) scenarios arise
* Ensure MCP payload & timeout budgets align with AFD + App Service defaults

---

## Phase 7 — Observability & Alerts

Metrics / Signals:
* AFD: origin health, 4xx/5xx rates, latency, throughput
* WAF: rule matches, bot actions, rate-limit triggers
* App: structured logs, correlation header (e.g., `X-Req-Id`)

Alerts:
* Origin unhealthy
* Spike in WAF blocks / rate-limits
* Elevated 5xx from origin

---

## Phase 8 — Enabling User Login (Future Cutover)

When ready:
1. Add additional identity providers (Google, Apple) if needed
2. Remove `/api/*` from Easy Auth exclusion list
3. Mobile app acquires user tokens (native auth or Easy Auth flow) and sends `Authorization: Bearer <token>`
4. No changes required to AFD, WAF, Private Link, or domain

---

## Quick Checklist (Operational)

- [ ] App Service hosts both `/api/*` and `/mcp/*`
- [ ] Header gate (`X-AFD-Gate`) enforced on `/mcp/*`
- [ ] Easy Auth ON; `/api/*` excluded (temporary); `/mcp/*` protected
- [ ] Allowed audiences include `api://<api-app-id>`
- [ ] AFD Premium + custom domain + TLS
- [ ] WAF: DRS + Bot + custom auth-header + rate-limit + size rules
- [ ] Private Link active; public access blocked
- [ ] AFD injects `X-AFD-Gate`
- [ ] Health probe responding (`/healthz`)
- [ ] Logging & alerts configured

---

## Future Enhancements / Notes

| Item | Rationale |
|------|-----------|
| Per-user rate limiting after login | Prevent abusive bursts once `/api/*` is secured |
| Central auth library in mobile app | Simplify token refresh & revocation |
| Signed response headers | Strengthen end-to-end trace integrity |
| Structured audit events for MCP calls | For model/tool invocation provenance |

---

## Metadata Snapshot

Original Issue: https://github.com/thrustCoder/gamer-uncle/issues/75 (Status: Open)
Author: @thrustCoder
Labels: (none at time of capture)
Milestone: None
Participants: 1
Captured: (local workspace sync)

---

> Keep this file authoritative; reflect material changes back to the GitHub issue to maintain external visibility.
