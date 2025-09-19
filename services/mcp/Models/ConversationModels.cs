using System;
using System.Collections.Generic;

namespace GamerUncle.Mcp.Models
{
    /// <summary>
    /// Represents MCP-specific conversation state
    /// </summary>
    public class McpConversation
    {
        public required string ConversationId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
        public List<McpQueryHistory> QueryHistory { get; set; } = new();
        public Dictionary<string, object> Context { get; set; } = new();
    }

    /// <summary>
    /// Represents a query in the conversation history
    /// </summary>
    public class McpQueryHistory
    {
        public required string Query { get; set; }
        public string? Response { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? ThreadId { get; set; }
    }
}