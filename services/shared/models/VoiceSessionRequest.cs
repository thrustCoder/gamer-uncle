using System.ComponentModel.DataAnnotations;

namespace GamerUncle.Shared.Models
{
    public class VoiceSessionRequest
    {
        [Required]
        public required string Query { get; set; } // Free-form board game question or request
        
        public string? ConversationId { get; set; } // Optional, links to existing text conversation
        
        public string? UserId { get; set; } // Optional, for user tracking
        
        public List<ConversationMessage>? RecentMessages { get; set; } // Optional recent conversation history for context
    }
    
    public class ConversationMessage
    {
        public required string Role { get; set; } // "user" or "assistant"
        public required string Content { get; set; } //Message content
    }
}