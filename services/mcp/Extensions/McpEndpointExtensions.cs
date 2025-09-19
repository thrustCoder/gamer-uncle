using GamerUncle.Mcp.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Http; // For HttpContext
using System.Text.Json;

namespace GamerUncle.Mcp.Extensions;

public static class McpEndpointExtensions
{
    /// <summary>
    /// Maps MCP unified SSE + POST endpoints:
    ///  POST /mcp/sse  (JSON-RPC requests: initialize, tools/list, tools/call, notifications)
    ///  GET  /mcp/sse  (SSE stream)
    ///  GET  /mcp/health (simple health probe)
    /// </summary>
    public static IEndpointRouteBuilder MapMcpEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var app = endpoints as WebApplication; // needed for environment checks (optional)

        // GET /mcp/sse (SSE stream)
        var sseGet = endpoints.MapGet("/mcp/sse", async (HttpContext context, ISseConnectionManager sseManager) =>
        {
            await sseManager.HandleSseConnection(context);
        });

        // Apply rate limiting outside development if policy configured
        if (app is not null && !app.Environment.IsDevelopment())
        {
            sseGet.RequireRateLimiting("McpSsePolicy");
        }

        // POST /mcp/sse (JSON-RPC request)
        endpoints.MapPost("/mcp/sse", async (
            HttpContext context,
            ISseConnectionManager sseManager,
            GamerUncleMcpServer server) =>
        {
            try
            {
                using var reader = new StreamReader(context.Request.Body);
                var body = await reader.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(body))
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync("Empty body");
                    return;
                }

                var isInitialize = false;
                try
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("method", out var m) && m.GetString() == "initialize")
                    {
                        isInitialize = true;
                    }
                }
                catch { /* ignore parse issues; server will error */ }

                var responseObj = await server.ProcessJsonRpcAsync(body);
                if (isInitialize)
                {
                    context.Response.ContentType = "application/json";
                    context.Response.StatusCode = StatusCodes.Status200OK;
                    await context.Response.WriteAsync(JsonSerializer.Serialize(responseObj));
                    await sseManager.QueueOrSend(responseObj);
                    return;
                }

                await sseManager.QueueOrSend(responseObj);
                context.Response.StatusCode = StatusCodes.Status202Accepted;
                await context.Response.WriteAsync("Accepted");
            }
            catch
            {
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync("Error");
            }
        });

        // Health
        endpoints.MapGet("/mcp/health", () => new { status = "healthy", transport = "sse" });

        return endpoints;
    }
}
