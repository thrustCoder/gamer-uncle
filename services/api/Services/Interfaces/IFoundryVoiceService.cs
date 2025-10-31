using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    public interface IFoundryVoiceService
    {
        /// <summary>
        /// Creates a new voice session with Azure AI Foundry Live Voice
        /// </summary>
        /// <param name="request">Voice session request containing query, conversation ID, and optional message history</param>
        /// <returns>Voice session response with WebRTC tokens and connection details</returns>
        Task<VoiceSessionResponse> CreateVoiceSessionAsync(VoiceSessionRequest request);
        
        /// <summary>
        /// Validates and refreshes an active voice session
        /// </summary>
        /// <param name="sessionId">The voice session ID</param>
        /// <returns>True if session is valid and active</returns>
        Task<bool> ValidateVoiceSessionAsync(string sessionId);
        
        /// <summary>
        /// Terminates an active voice session
        /// </summary>
        /// <param name="sessionId">The voice session ID</param>
        /// <returns>True if session was successfully terminated</returns>
        Task<bool> TerminateVoiceSessionAsync(string sessionId);
        
        /// <summary>
        /// Retrieves current status of a voice session
        /// </summary>
        /// <param name="sessionId">The voice session ID</param>
        /// <returns>Session status information</returns>
        Task<VoiceSessionStatus?> GetVoiceSessionStatusAsync(string sessionId);
    }

    public class VoiceSessionStatus
    {
        public required string SessionId { get; set; }
        
        public required string Status { get; set; } // "active", "expired", "terminated", "error"
        
        public DateTime CreatedAt { get; set; }
        
        public DateTime ExpiresAt { get; set; }
        
        public string? ConversationId { get; set; }
        
        public int ParticipantCount { get; set; }
    }
}