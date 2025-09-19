using System.Linq;
using GamerUncle.Mcp.Models;
using GamerUncle.Mcp.Services;
using GamerUncle.Mcp.Tools;
using GamerUncle.Shared.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace GamerUncle.Mcp.Tests
{
    public class BoardGameQueryToolTests
    {
        [Fact]
        public async Task board_game_query_Success_AppendsMatchCountAnnotation()
        {
            var agentMock = new Mock<IAgentServiceClient>();
            agentMock.Setup(a => a.GetRecommendationsAsync("recommend", null))
                .ReturnsAsync(new AgentResponse { ResponseText = "Base answer", ThreadId = "thread1", MatchingGamesCount = 3 });

            var convo = new McpConversation { ConversationId = "conv123" };
            var convoServiceMock = new Mock<IConversationStateService>();
            convoServiceMock.Setup(s => s.GetOrCreateConversation("conv123")).Returns(convo);
            convoServiceMock.Setup(s => s.UpdateConversation("conv123", "recommend", "Base answer", "thread1"));

            var tool = new BoardGameQueryTool(agentMock.Object, convoServiceMock.Object, NullLogger<BoardGameQueryTool>.Instance);

            var result = await tool.board_game_query("recommend", "conv123");

            Assert.NotNull(result);
            Assert.Equal("thread1", result.ThreadId);
            Assert.Equal(3, result.MatchingGamesCount);
            Assert.Contains("Base answer", result.ResponseText);
            Assert.Contains("[Found 3 matching games in database]", result.ResponseText);
            convoServiceMock.VerifyAll();
            agentMock.VerifyAll();
        }

        [Fact]
        public async Task board_game_query_UsesPreviousThreadId_WhenConversationHistoryExists()
        {
            var previousThreadId = "prev-thread";
            var convo = new McpConversation { ConversationId = "convX" };
            convo.QueryHistory.Add(new McpQueryHistory { Query = "old", Response = "resp", ThreadId = previousThreadId });

            var agentMock = new Mock<IAgentServiceClient>();
            agentMock.Setup(a => a.GetRecommendationsAsync("follow up", previousThreadId))
                .ReturnsAsync(new AgentResponse { ResponseText = "Follow answer", ThreadId = "new-thread", MatchingGamesCount = null });

            var convoServiceMock = new Mock<IConversationStateService>();
            convoServiceMock.Setup(s => s.GetOrCreateConversation("convX")).Returns(convo);
            convoServiceMock.Setup(s => s.UpdateConversation("convX", "follow up", "Follow answer", "new-thread"));

            var tool = new BoardGameQueryTool(agentMock.Object, convoServiceMock.Object, NullLogger<BoardGameQueryTool>.Instance);
            var result = await tool.board_game_query("follow up", "convX");

            Assert.Equal("new-thread", result.ThreadId);
            agentMock.VerifyAll();
            convoServiceMock.VerifyAll();
        }

        [Fact]
        public async Task board_game_query_ErrorPath_ReturnsFallbackMessage()
        {
            var agentMock = new Mock<IAgentServiceClient>();
            agentMock.Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string?>()))
                .ThrowsAsync(new InvalidOperationException("boom"));

            var convo = new McpConversation { ConversationId = "convErr" };
            var convoServiceMock = new Mock<IConversationStateService>();
            convoServiceMock.Setup(s => s.GetOrCreateConversation("convErr")).Returns(convo);
            // UpdateConversation shouldn't be called in error path, but we won't assert strictly (VerifyNoOtherCalls) to keep test resilient

            var tool = new BoardGameQueryTool(agentMock.Object, convoServiceMock.Object, NullLogger<BoardGameQueryTool>.Instance);
            var result = await tool.board_game_query("anything", "convErr");

            Assert.NotNull(result.ResponseText);
            Assert.Contains("I encountered an error", result.ResponseText);
            Assert.Null(result.ThreadId);
            Assert.Null(result.MatchingGamesCount);
        }

        [Fact]
        public async Task board_game_query_GeneratesConversationId_WhenNotProvided()
        {
            string? capturedId = null;
            var convoServiceMock = new Mock<IConversationStateService>();
            convoServiceMock.Setup(s => s.GetOrCreateConversation(It.IsAny<string>()))
                .Returns((string id) => {
                    capturedId = id; return new McpConversation { ConversationId = id };
                });
            convoServiceMock.Setup(s => s.UpdateConversation(It.IsAny<string>(), "query", "Resp", It.IsAny<string?>()))
                .Callback<string, string, string?, string?>((id, q, r, th) => { capturedId ??= id; });

            var agentMock = new Mock<IAgentServiceClient>();
            agentMock.Setup(a => a.GetRecommendationsAsync("query", null))
                .ReturnsAsync(new AgentResponse { ResponseText = "Resp", ThreadId = "t1" });

            var tool = new BoardGameQueryTool(agentMock.Object, convoServiceMock.Object, NullLogger<BoardGameQueryTool>.Instance);
            var result = await tool.board_game_query("query", null);

            Assert.NotNull(result);
            Assert.False(string.IsNullOrWhiteSpace(capturedId));
            agentMock.VerifyAll();
        }
    }
}
