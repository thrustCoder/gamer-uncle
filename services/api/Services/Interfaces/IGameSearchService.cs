using GamerUncle.Api.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    /// <summary>
    /// Service interface for game search functionality with L1/L2 caching.
    /// </summary>
    public interface IGameSearchService
    {
        /// <summary>
        /// Searches for games by name using type-ahead matching.
        /// Results are cached in L1 (memory) and L2 (Redis) for performance.
        /// </summary>
        /// <param name="query">Search query (minimum 3 characters)</param>
        /// <param name="maxResults">Maximum number of results to return (default: 5)</param>
        /// <returns>Search results with matching games</returns>
        Task<GameSearchResponse> SearchGamesAsync(string query, int maxResults = 5);

        /// <summary>
        /// Retrieves detailed information for a specific game by ID.
        /// Results are cached in L1 (memory) and L2 (Redis) for performance.
        /// </summary>
        /// <param name="gameId">The game ID (e.g., "bgg-13")</param>
        /// <returns>Game details if found, null otherwise</returns>
        Task<GameDetailsResponse?> GetGameDetailsAsync(string gameId);
    }
}
