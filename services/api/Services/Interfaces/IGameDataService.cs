using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    public interface IGameDataService
    {
        /// <summary>
        /// Retrieves game data for voice session preload context
        /// </summary>
        /// <param name="gameId">The BGG game ID (with bgg- prefix)</param>
        /// <returns>Game document if found, null otherwise</returns>
        Task<GameDocument?> GetGameForVoiceSessionAsync(string gameId);
        
        /// <summary>
        /// Validates if a game ID exists and can be used for voice sessions
        /// </summary>
        /// <param name="gameId">The BGG game ID (with bgg- prefix)</param>
        /// <returns>True if game exists and is suitable for voice sessions</returns>
        Task<bool> ValidateGameForVoiceSessionAsync(string gameId);

        /// <summary>
        /// Gets formatted game context for Foundry system message injection
        /// </summary>
        /// <param name="query">User's query to find relevant games</param>
        /// <param name="conversationId">Optional conversation ID for context</param>
        /// <returns>Formatted context string for Foundry system message</returns>
        Task<string> GetGameContextForFoundryAsync(string query, string? conversationId = null);

        /// <summary>
        /// Finds relevant games based on query for RAG context
        /// </summary>
        /// <param name="query">User's query</param>
        /// <param name="maxResults">Maximum number of games to return</param>
        /// <returns>List of relevant game documents</returns>
        Task<List<GameDocument>> GetRelevantGamesForQueryAsync(string query, int maxResults = 5);
    }
}