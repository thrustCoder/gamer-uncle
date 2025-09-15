namespace GamerUncle.Shared.Models
{
    public class VoiceSessionResponse
    {
        public required string SessionId { get; set; }
        
        public required string WebRtcToken { get; set; }
        
        public required string FoundryConnectionUrl { get; set; }
        
        public DateTime ExpiresAt { get; set; }
        
        public string? ConversationId { get; set; } // Links to text conversation if provided
        
        public string? InitialResponse { get; set; } // AI's initial spoken response to the user's query
    }
}