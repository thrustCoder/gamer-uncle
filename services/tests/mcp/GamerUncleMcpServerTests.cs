using System.Text.Json;
using GamerUncle.Mcp.Services;
using GamerUncle.Mcp.Tools;
using GamerUncle.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace GamerUncle.Mcp.Tests
{
    public class GamerUncleMcpServerTests
    {
        private (GamerUncleMcpServer server, Mock<IAgentServiceClient> agentMock, ServiceProvider provider, AgentResponse response) CreateServer(
            AgentResponse? toolResponse = null)
        {
            var services = new ServiceCollection();
            services.AddSingleton<ILoggerFactory>(sp => NullLoggerFactory.Instance);
            services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));

            // Configuration for ConversationStateService
            var inMemoryConfig = new Dictionary<string, string?>
            {
                {"Mcp:MaxQueryHistorySize", "10"},
                {"Mcp:ConversationLifetimeHours", "1"}
            };
            IConfiguration config = new ConfigurationBuilder().AddInMemoryCollection(inMemoryConfig!).Build();
            services.AddSingleton(config);

            // Mock agent service (what BoardGameQueryTool calls)
            var agentMock = new Mock<IAgentServiceClient>();
            toolResponse ??= new AgentResponse { ResponseText = "Test response", ThreadId = "thread-1", MatchingGamesCount = 2 };
            agentMock.Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string?>()))
                .ReturnsAsync(toolResponse);
            services.AddSingleton(agentMock.Object);

            // Real conversation state service
            services.AddSingleton<IConversationStateService>(sp =>
                new ConversationStateService(sp.GetRequiredService<ILogger<ConversationStateService>>(), config));

            // Register BoardGameQueryTool (real)
            services.AddSingleton<BoardGameQueryTool>();

            var provider = services.BuildServiceProvider();
            var server = new GamerUncleMcpServer(provider, provider.GetRequiredService<ILogger<GamerUncleMcpServer>>());
            return (server, agentMock, (ServiceProvider)provider, toolResponse);
        }

        private static JsonElement GetJsonElement(object obj)
        {
            var json = JsonSerializer.Serialize(obj);
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_Initialize_ReturnsExpectedProtocolVersion()
        {
            var (server, _, _, _) = CreateServer();
            var request = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-12-01\"}}";
            var response = await server.ProcessJsonRpcAsync(request);
            var json = GetJsonElement(response);
            Assert.Equal("2.0", json.GetProperty("jsonrpc").GetString());
            Assert.Equal(1, json.GetProperty("id").GetInt32());
            Assert.Equal("2024-12-01", json.GetProperty("result").GetProperty("protocolVersion").GetString());
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_ToolsList_ReturnsToolDefinition()
        {
            var (server, _, _, _) = CreateServer();
            var request = "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}";
            var response = await server.ProcessJsonRpcAsync(request);
            var json = GetJsonElement(response);
            var tools = json.GetProperty("result").GetProperty("tools").EnumerateArray().ToList();
            Assert.Single(tools);
            Assert.Equal("board_game_query", tools[0].GetProperty("name").GetString());
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_ToolCall_Success_ReturnsStructuredContent()
        {
            var (server, agentMock, _, toolResp) = CreateServer();
            var request = "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"board_game_query\",\"arguments\":{\"query\":\"recommend games\",\"conversationId\":\"conv-1\"}}}";
            var response = await server.ProcessJsonRpcAsync(request);
            agentMock.Verify(a => a.GetRecommendationsAsync("recommend games", It.IsAny<string?>()), Times.Once);
            var json = GetJsonElement(response);
            Assert.Equal("2.0", json.GetProperty("jsonrpc").GetString());
            Assert.Equal(3, json.GetProperty("id").GetInt32());
            var content = json.GetProperty("result").GetProperty("content").EnumerateArray().ToList();
            Assert.Equal(2, content.Count); // text + json blocks
            Assert.Equal("text", content[0].GetProperty("type").GetString());
            Assert.Equal("json", content[1].GetProperty("type").GetString());
            // Validate that response text contains our mocked response
            var textBlock = content[0].GetProperty("text").GetString() ?? string.Empty;
            if (toolResp.ResponseText is not null)
            {
                Assert.Contains(toolResp.ResponseText, textBlock);
            }
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_ToolCall_UnknownTool_ReturnsError()
        {
            var (server, _, _, _) = CreateServer();
            var request = "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"unknown_tool\",\"arguments\":{\"query\":\"x\"}}}";
            var response = await server.ProcessJsonRpcAsync(request);
            var json = GetJsonElement(response);
            Assert.Equal(-32603, json.GetProperty("error").GetProperty("code").GetInt32());
            Assert.Contains("Unknown tool", json.GetProperty("error").GetProperty("message").GetString());
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_UnknownMethod_ReturnsError()
        {
            var (server, _, _, _) = CreateServer();
            var request = "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"nonexistent\"}";
            var response = await server.ProcessJsonRpcAsync(request);
            var json = GetJsonElement(response);
            Assert.Equal(-32603, json.GetProperty("error").GetProperty("code").GetInt32());
            Assert.Contains("Unknown method", json.GetProperty("error").GetProperty("message").GetString());
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_InvalidJson_ReturnsInternalError()
        {
            var (server, _, _, _) = CreateServer();
            var badRequest = "{not json}"; // parsing will throw
            var response = await server.ProcessJsonRpcAsync(badRequest);
            var json = GetJsonElement(response);
            Assert.Equal(-32603, json.GetProperty("error").GetProperty("code").GetInt32());
            Assert.Contains("Internal server error", json.GetProperty("error").GetProperty("message").GetString());
        }

        [Fact]
        public async Task ProcessJsonRpcAsync_ToolCall_MissingQuery_ReturnsError()
        {
            var (server, _, _, _) = CreateServer();
            var request = "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"board_game_query\",\"arguments\":{}}}";
            var response = await server.ProcessJsonRpcAsync(request);
            var json = GetJsonElement(response);
            Assert.Equal(-32603, json.GetProperty("error").GetProperty("code").GetInt32());
            Assert.Contains("Missing query argument", json.GetProperty("error").GetProperty("message").GetString());
        }
    }
}
