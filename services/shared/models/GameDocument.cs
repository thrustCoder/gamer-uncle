using System.Collections.Generic;
using System;
using System.Text.Json.Serialization;

namespace GamerUncle.Shared.Models
{
    public class GameDocument
    {
        public string id { get; set; } = default!; // BGG ID prefixed with bgg-
        public string name { get; set; } = default!;
        public string overview { get; set; } = string.Empty;
        public string description { get; set; } = string.Empty;
        public int minPlayers { get; set; }
        public int maxPlayers { get; set; }
        public int minPlaytime { get; set; }
        public int maxPlaytime { get; set; }
        public double weight { get; set; }
        public double averageRating { get; set; }
        public double bggRating { get; set; }
        public int numVotes { get; set; }
        public int ageRequirement { get; set; }
        public int yearPublished { get; set; }
        public string imageUrl { get; set; } = string.Empty;
        public string shopLink { get; set; } = string.Empty;

        public List<string> mechanics { get; set; } = new();
        public List<string> categories { get; set; } = new();

        public string setupGuide { get; set; } = string.Empty;
        public string rulesUrl { get; set; } = string.Empty;

        public List<RuleQnA> ruleQnA { get; set; } = new();
        public List<ModeratorScript> moderatorScripts { get; set; } = new();
        public NarrationTTS? narrationTTS { get; set; }

        public string type { get; set; } = "game";
        public DateTime updatedAt { get; set; } = DateTime.UtcNow;
    }

    public class RuleQnA
    {
        public string question { get; set; } = default!;
        public string answer { get; set; } = default!;
        public string source { get; set; } = string.Empty;
    }

    public class ModeratorScript
    {
        public string language { get; set; } = "en";
        public string script { get; set; } = string.Empty;
    }

    public class NarrationTTS
    {
        public string introduction { get; set; } = string.Empty;
        public string turnInstructions { get; set; } = string.Empty;
    }
}
