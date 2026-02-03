namespace GamerUncle.Api.Models
{
    /// <summary>
    /// Response model for game search results.
    /// </summary>
    public class GameSearchResponse
    {
        /// <summary>
        /// List of games matching the search query.
        /// </summary>
        public List<GameSearchResult> Results { get; set; } = new();

        /// <summary>
        /// Total number of results found (may be more than returned).
        /// </summary>
        public int TotalCount { get; set; }
    }

    /// <summary>
    /// Individual game result in search response (lightweight).
    /// </summary>
    public class GameSearchResult
    {
        /// <summary>
        /// Game ID (e.g., "bgg-13").
        /// </summary>
        public string Id { get; set; } = string.Empty;

        /// <summary>
        /// Game name.
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// URL to game thumbnail image.
        /// </summary>
        public string? ImageUrl { get; set; }

        /// <summary>
        /// Average user rating (BGG 10-point scale).
        /// </summary>
        public double AverageRating { get; set; }

        /// <summary>
        /// Minimum number of players.
        /// </summary>
        public int MinPlayers { get; set; }

        /// <summary>
        /// Maximum number of players.
        /// </summary>
        public int MaxPlayers { get; set; }
    }
}
