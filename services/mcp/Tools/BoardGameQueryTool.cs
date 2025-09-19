using System.ComponentModel;
using ModelContextProtocol.Server;
using GamerUncle.Shared.Models;
using GamerUncle.Mcp.Services;
using Microsoft.Extensions.Logging;

namespace GamerUncle.Mcp.Tools
{
    /// <summary>
    /// MCP tool for board game queries and recommendations
    /// </summary>
    [McpServerToolType]
    public class BoardGameQueryTool
    {
        private readonly IAgentServiceClient _agentService;
        private readonly IConversationStateService _conversationStateService;
        private readonly ILogger<BoardGameQueryTool> _logger;

        public BoardGameQueryTool(
            IAgentServiceClient agentService,
            IConversationStateService conversationStateService,
            ILogger<BoardGameQueryTool> logger)
        {
            _agentService = agentService;
            _conversationStateService = conversationStateService;
            _logger = logger;
        }

        /// <summary>
        /// Query board games and get recommendations
        /// </summary>
        /// <param name="query">The board game query (e.g., "recommend games for 4 players", "explain Monopoly rules")</param>
        /// <param name="conversationId">Optional conversation ID to maintain context across queries</param>
        /// <returns>Board game recommendations and information</returns>
        [McpServerTool(UseStructuredContent = true)]
        [Description("Query board games, get recommendations, rules explanations, and strategy advice. Supports conversational context for follow-up questions.")]
        public async Task<AgentResponse> board_game_query(
            [Description("Your board game question or request (e.g., 'recommend cooperative games for 3 players', 'explain Catan rules', 'strategy tips for Splendor')")] string query,
            [Description("Optional conversation ID to maintain context across multiple queries")] string? conversationId = null)
        {
            try
            {
                // Generate conversation ID if not provided
                conversationId ??= Guid.NewGuid().ToString();

                _logger.LogInformation("Processing MCP board game query: {Query} (ConversationId: {ConversationId})", query, conversationId);

                // Get or create conversation state
                var conversation = _conversationStateService.GetOrCreateConversation(conversationId);

                // Use the existing agent service to get recommendations
                // The conversationId here maps to the threadId used by the agent service
                var result = await _agentService.GetRecommendationsAsync(query, conversation.QueryHistory.LastOrDefault()?.ThreadId);

                // Update conversation state
                _conversationStateService.UpdateConversation(conversationId, query, result.ResponseText, result.ThreadId);

                _logger.LogInformation("Successfully processed MCP board game query for conversation {ConversationId}", conversationId);

                // Build response text with optional metadata annotation
                var responseText = result.ResponseText ?? "I couldn't process your request right now. Please try again later.";
                if (result.MatchingGamesCount.HasValue && result.MatchingGamesCount > 0)
                {
                    responseText += $"\n\n[Found {result.MatchingGamesCount} matching games in database]";
                }

                return new AgentResponse
                {
                    ResponseText = responseText,
                    ThreadId = result.ThreadId,
                    MatchingGamesCount = result.MatchingGamesCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing MCP board game query: {Query} (ConversationId: {ConversationId})", query, conversationId);
                return new AgentResponse
                {
                    ResponseText = "I encountered an error while processing your board game query. Please try again later.",
                    ThreadId = null,
                    MatchingGamesCount = null
                };
            }
        }
    }
}