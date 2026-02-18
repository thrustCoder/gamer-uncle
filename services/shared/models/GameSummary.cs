using System.Collections.Generic;

namespace GamerUncle.Shared.Models
{
    /// <summary>
    /// Lightweight projection of GameDocument containing only the fields needed
    /// for RAG context formatting and game recommendations.
    /// Used by Cosmos DB SELECT projection to avoid transferring heavy fields
    /// like description, setupGuide, ruleQnA, moderatorScripts, and narrationTTS.
    /// </summary>
    public class GameSummary
    {
        public string id { get; set; } = default!;
        public string name { get; set; } = default!;
        public string overview { get; set; } = string.Empty;
        public int minPlayers { get; set; }
        public int maxPlayers { get; set; }
        public int minPlaytime { get; set; }
        public int maxPlaytime { get; set; }
        public double weight { get; set; }
        public double averageRating { get; set; }
        public string imageUrl { get; set; } = string.Empty;
        public List<string> mechanics { get; set; } = new();
        public List<string> categories { get; set; } = new();
    }
}
