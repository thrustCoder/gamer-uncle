using System.Collections.Concurrent;
using GamerUncle.Mcp.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace GamerUncle.Mcp.Services
{
    /// <summary>
    /// Manages MCP-specific conversation state separately from the main API conversation state
    /// </summary>
    public interface IConversationStateService
    {
        McpConversation GetOrCreateConversation(string conversationId);
        void UpdateConversation(string conversationId, string query, string? response, string? threadId = null);
        void CleanupExpiredConversations();
    }

    public class ConversationStateService : IConversationStateService
    {
        private readonly ConcurrentDictionary<string, McpConversation> _conversations = new();
        private readonly ILogger<ConversationStateService> _logger;
        private readonly int _maxQueryHistorySize;
        private readonly TimeSpan _conversationLifetime;

        public ConversationStateService(ILogger<ConversationStateService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _maxQueryHistorySize = configuration.GetValue<int>("Mcp:MaxQueryHistorySize", 20);
            _conversationLifetime = TimeSpan.FromHours(configuration.GetValue<int>("Mcp:ConversationLifetimeHours", 2));
        }

        public McpConversation GetOrCreateConversation(string conversationId)
        {
            return _conversations.GetOrAdd(conversationId, id => new McpConversation
            {
                ConversationId = id
            });
        }

        public void UpdateConversation(string conversationId, string query, string? response, string? threadId = null)
        {
            if (_conversations.TryGetValue(conversationId, out var conversation))
            {
                conversation.LastActivityAt = DateTime.UtcNow;

                var historyEntry = new McpQueryHistory
                {
                    Query = query,
                    Response = response,
                    ThreadId = threadId
                };

                conversation.QueryHistory.Add(historyEntry);

                // Limit history size
                while (conversation.QueryHistory.Count > _maxQueryHistorySize)
                {
                    conversation.QueryHistory.RemoveAt(0);
                }

                _logger.LogDebug("Updated MCP conversation {ConversationId} with query history entry", conversationId);
            }
        }

        public void CleanupExpiredConversations()
        {
            var cutoffTime = DateTime.UtcNow - _conversationLifetime;
            var expiredKeys = _conversations
                .Where(kvp => kvp.Value.LastActivityAt < cutoffTime)
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var key in expiredKeys)
            {
                if (_conversations.TryRemove(key, out _))
                {
                    _logger.LogDebug("Removed expired MCP conversation {ConversationId}", key);
                }
            }
        }
    }
}