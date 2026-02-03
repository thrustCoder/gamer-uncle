namespace GamerUncle.Api.Models
{
    /// <summary>
    /// Response model for detailed game information.
    /// </summary>
    public class GameDetailsResponse
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
        /// URL to game image.
        /// </summary>
        public string? ImageUrl { get; set; }

        /// <summary>
        /// Brief overview/description of the game.
        /// </summary>
        public string Overview { get; set; } = string.Empty;

        /// <summary>
        /// Average user rating (BGG 10-point scale).
        /// </summary>
        public double AverageRating { get; set; }

        /// <summary>
        /// BGG rating (Bayesian average, 10-point scale).
        /// </summary>
        public double BggRating { get; set; }

        /// <summary>
        /// Number of user votes/ratings.
        /// </summary>
        public int NumVotes { get; set; }

        /// <summary>
        /// Minimum number of players.
        /// </summary>
        public int MinPlayers { get; set; }

        /// <summary>
        /// Maximum number of players.
        /// </summary>
        public int MaxPlayers { get; set; }

        /// <summary>
        /// Minimum recommended age.
        /// </summary>
        public int AgeRequirement { get; set; }

        /// <summary>
        /// URL to game rules/rulebook.
        /// </summary>
        public string? RulesUrl { get; set; }

        /// <summary>
        /// Minimum playtime in minutes.
        /// </summary>
        public int MinPlaytime { get; set; }

        /// <summary>
        /// Maximum playtime in minutes.
        /// </summary>
        public int MaxPlaytime { get; set; }

        /// <summary>
        /// Year the game was published.
        /// </summary>
        public int YearPublished { get; set; }

        /// <summary>
        /// Game complexity weight (1-5 scale).
        /// </summary>
        public double Weight { get; set; }

        /// <summary>
        /// List of game mechanics (e.g., "Deck Building", "Worker Placement").
        /// </summary>
        public List<string> Mechanics { get; set; } = new();

        /// <summary>
        /// List of game categories (e.g., "Strategy", "Family").
        /// </summary>
        public List<string> Categories { get; set; } = new();
    }
}
