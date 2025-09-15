using System.ComponentModel.DataAnnotations;

namespace GamerUncle.Shared.Models
{
    public class VoiceSessionRequest
    {
        [Required]
        public required string Query { get; set; } // Free-form board game question or request
        
        public string? ConversationId { get; set; } // Optional, links to existing text conversation
        
        public string? UserId { get; set; } // Optional, for user tracking
    }
}