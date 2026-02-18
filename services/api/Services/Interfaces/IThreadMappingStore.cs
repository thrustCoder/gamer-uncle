namespace GamerUncle.Api.Services.Interfaces
{
    /// <summary>
    /// Stores conversation-to-AI-thread mappings.
    /// Replaces the in-memory ConcurrentDictionary to support multi-instance
    /// deployments and survive app restarts (Finding #2 in scaling analysis).
    /// </summary>
    public interface IThreadMappingStore
    {
        /// <summary>
        /// Gets the AI thread ID for a given conversation ID. Returns null if not found.
        /// </summary>
        Task<string?> GetThreadIdAsync(string conversationId);

        /// <summary>
        /// Maps a conversation ID to an AI thread ID with automatic TTL-based expiry.
        /// </summary>
        Task SetThreadIdAsync(string conversationId, string threadId);

        /// <summary>
        /// Removes the mapping for a conversation ID (e.g., on conversation end).
        /// </summary>
        Task RemoveAsync(string conversationId);
    }
}
