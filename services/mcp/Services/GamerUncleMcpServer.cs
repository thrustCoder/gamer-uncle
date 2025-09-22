using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;

namespace GamerUncle.Mcp.Services
{
    /// <summary>
    /// Gamer Uncle MCP Server implementation with SSE support
    /// </summary>
    public class GamerUncleMcpServer
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<GamerUncleMcpServer> _logger;

        public GamerUncleMcpServer(
            IServiceProvider serviceProvider,
            ILogger<GamerUncleMcpServer> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Processes a JSON-RPC payload (raw string) and returns the response object
        /// without side-effects (no direct SSE emission).
        /// </summary>
        public async Task<object> ProcessJsonRpcAsync(string requestBody)
        {
            try
            {
                _logger.LogDebug("Processing MCP JSON-RPC payload: {RequestBody}", requestBody);

                using var jsonDoc = JsonDocument.Parse(requestBody);
                var root = jsonDoc.RootElement;

                if (!root.TryGetProperty("method", out var methodElement))
                {
                    return CreateErrorResponse("Missing method in request", null);
                }

                var method = methodElement.GetString();
                object? idValue = null;
                if (root.TryGetProperty("id", out var idElement))
                {
                    if (idElement.ValueKind == JsonValueKind.String)
                        idValue = idElement.GetString();
                    else if (idElement.ValueKind == JsonValueKind.Number && idElement.TryGetInt64(out var longId))
                        idValue = longId; // Preserve numeric ID type
                }

                _logger.LogInformation("Dispatching MCP method: {Method} (ID: {Id})", method, idValue);

                return method switch
                {
                    "initialize" => await HandleInitialize(root, idValue),
                    "tools/list" => await HandleToolsList(root, idValue),
                    "tools/call" => await HandleToolCall(root, idValue),
                    "prompts/list" => await HandlePromptsList(root, idValue),
                    "notifications/initialized" => await HandleNotificationsInitialized(root, idValue),
                    _ => CreateErrorResponse($"Unknown method: {method}", idValue)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing MCP JSON-RPC message");
                return CreateErrorResponse("Internal server error", null);
            }
        }

        private Task<object> HandleInitialize(JsonElement root, object? id)
        {
            string clientProtocolVersion = "2024-11-05"; // default fallback
            try
            {
                if (root.TryGetProperty("params", out var paramsElement) &&
                    paramsElement.ValueKind == JsonValueKind.Object &&
                    paramsElement.TryGetProperty("protocolVersion", out var pv) &&
                    pv.ValueKind == JsonValueKind.String)
                {
                    clientProtocolVersion = pv.GetString() ?? clientProtocolVersion;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to read client protocolVersion - using fallback {Fallback}", clientProtocolVersion);
            }

            _logger.LogInformation("Handling MCP initialize request (client protocolVersion={ClientVersion})", clientProtocolVersion);

            return Task.FromResult<object>(new
            {
                jsonrpc = "2.0",
                id,
                result = new
                {
                    protocolVersion = clientProtocolVersion,
                    capabilities = new
                    {
                        tools = new { },
                        resources = new { },
                        prompts = new { }
                    },
                    serverInfo = new
                    {
                        name = "gamer-uncle-mcp-server",
                        version = "1.0.0"
                    }
                }
            });
        }

        private Task<object> HandleToolsList(JsonElement root, object? id)
        {
            _logger.LogInformation("Handling MCP tools/list request");

            return Task.FromResult<object>(new
            {
                jsonrpc = "2.0",
                id,
                result = new
                {
                    tools = new[]
                    {
                        new
                        {
                            name = "board_game_query",
                            description = "Query board games, get recommendations, rules explanations, and strategy advice. Supports conversational context for follow-up questions.",
                            inputSchema = new
                            {
                                type = "object",
                                properties = new
                                {
                                    query = new
                                    {
                                        type = "string",
                                        description = "Your board game question or request (e.g., 'recommend cooperative games for 3 players', 'explain Catan rules', 'strategy tips for Splendor')"
                                    },
                                    conversationId = new
                                    {
                                        type = "string",
                                        description = "Optional conversation ID to maintain context across multiple queries"
                                    }
                                },
                                required = new[] { "query" }
                            }
                        }
                    }
                }
            });
        }

        private async Task<object> HandleToolCall(JsonElement root, object? id)
        {
            try
            {
                if (!root.TryGetProperty("params", out var paramsElement))
                {
                    return CreateErrorResponse("Missing params in tool call", id);
                }

                if (!paramsElement.TryGetProperty("name", out var nameElement))
                {
                    return CreateErrorResponse("Missing tool name in params", id);
                }

                var toolName = nameElement.GetString();
                _logger.LogInformation("Handling MCP tool call: {ToolName}", toolName);

                if (toolName != "board_game_query")
                {
                    return CreateErrorResponse($"Unknown tool: {toolName}", id);
                }

                if (!paramsElement.TryGetProperty("arguments", out var argsElement))
                {
                    return CreateErrorResponse("Missing arguments in tool call", id);
                }

                if (!argsElement.TryGetProperty("query", out var queryElement))
                {
                    return CreateErrorResponse("Missing query argument", id);
                }

                var query = queryElement.GetString();
                var conversationId = argsElement.TryGetProperty("conversationId", out var convIdElement)
                    ? convIdElement.GetString()
                    : null;
                if (string.IsNullOrWhiteSpace(conversationId))
                {
                    conversationId = Guid.NewGuid().ToString();
                }

                // Get the BoardGameQueryTool from DI and call it
                using var scope = _serviceProvider.CreateScope();
                var boardGameTool = scope.ServiceProvider.GetRequiredService<Tools.BoardGameQueryTool>();

                var agentResponse = await boardGameTool.board_game_query(query!, conversationId);

                var responseText = agentResponse.ResponseText ?? "No response produced.";

                // Structured JSON metadata for programmatic use
                var jsonContent = new
                {
                    responseText = responseText,
                    threadId = agentResponse.ThreadId,
                    matchingGamesCount = agentResponse.MatchingGamesCount,
                    conversationId
                };

                // Return both a human-readable text block (for Copilot chat rendering)
                // and a json block (for clients that parse structured content)
                return new
                {
                    jsonrpc = "2.0",
                    id,
                    result = new
                    {
                        content = new object[]
                        {
                            new { type = "text", text = responseText },
                            new { type = "json", json = jsonContent }
                        }
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling tool call");
                return CreateErrorResponse("Error executing tool", id);
            }
        }

        private Task<object> HandlePromptsList(JsonElement root, object? id)
        {
            // Currently no prompts implemented; return empty list per MCP expectations.
            _logger.LogInformation("Handling MCP prompts/list request (no prompts defined)");
            return Task.FromResult<object>(new
            {
                jsonrpc = "2.0",
                id,
                result = new
                {
                    prompts = Array.Empty<object>()
                }
            });
        }

        private Task<object> HandleNotificationsInitialized(JsonElement root, object? id)
        {
            // Some clients send this as a notification (id may be null). We acknowledge silently.
            _logger.LogInformation("Received notifications/initialized (id={Id})", id);
            return Task.FromResult<object>(new
            {
                jsonrpc = "2.0",
                id, // Will be null for JSON-RPC notification; acceptable.
                result = new
                {
                    acknowledged = true,
                    timestampUtc = DateTime.UtcNow
                }
            });
        }

        private static object CreateErrorResponse(string message, object? id)
        {
            return new
            {
                jsonrpc = "2.0",
                id,
                error = new
                {
                    code = -32603,
                    message
                }
            };
        }
    }
}