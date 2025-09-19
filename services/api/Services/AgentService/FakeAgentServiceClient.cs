using GamerUncle.Api.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.AgentService
{
    /// <summary>
    /// Deterministic fake implementation used in functional tests to avoid live Azure Agent calls
    /// and eliminate flaky fallback / thread errors. Enabled when TEST_ENVIRONMENT=Local or
    /// AGENT_USE_FAKE=true.
    /// </summary>
    public class FakeAgentServiceClient : IAgentServiceClient
    {
        private static readonly Dictionary<string, string> CannedResponses = new(StringComparer.OrdinalIgnoreCase)
        {
            ["I want a strategic board game for 2-4 players"] = "Try Splendor, Azul or 7 Wonders – strategic, quick to learn and shine at 2–4 players.",
            ["fun game"] = "Ticket to Ride is a classic fun gateway game with simple turns and satisfying route building.",
            ["Tell me about Catan"] = "Catan: Trade resources (wood, brick, wheat, sheep, ore) to build roads & settlements; expand, block opponents & race to 10 points.",
            ["What about party games?"] = "Great party picks: Codenames (word deduction), Just One (co‑op clueing) and Dixit (creative storytelling).",
            ["I want a strategic board game"] = "Consider Terraforming Mars for engine building or Wingspan for gentle tableau strategy.",
            ["Je veux un jeu de société français 🎲 游戏推荐 спасибо"] = "Pour un public mixte: Dixit, Carcassonne, Azul – accessibles et multilingues.",
            ["What makes a game family friendly?"] = "Family friendly = short turns, low downtime, clear iconography, forgiving rules & positive interaction.",
            ["How to win at Ticket to Ride?"] = "Prioritise long routes early, secure critical choke connections, chain tickets sharing track & deny obvious opponent links.",
            ["What are worker placement games?"] = "Worker placement: you assign limited workers to exclusive action spots (e.g. Agricola, Lords of Waterdeep) creating tension over scarce actions.",
            ["I am looking for a new board game."] = "Give Cascadia or Azul a try – quick to teach, satisfying puzzles and great table presence.",
            ["'; DROP TABLE Games; SELECT * FROM Users WHERE '1'='1"] = "Nice try 😀 Let’s stick to board games! Ask me about mechanics or player counts instead.",
            ["<script>alert('XSS')</script><img src=x onerror=alert('XSS')>"] = "That looks like HTML/JS – I’ll ignore it. Ask me for a recommendation instead!",
            ["strategy game strategy game"] = "For heavier strategy: Brass: Birmingham (economic routes) or Gaia Project (deep asymmetry)."
        };

        public Task<AgentResponse> GetRecommendationsAsync(string userInput, string? threadId = null)
        {
            var trimmed = (userInput ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                return Task.FromResult(new AgentResponse
                {
                    ResponseText = "Please ask something about board games – player count, style, theme, anything!",
                    ThreadId = threadId,
                    MatchingGamesCount = 0
                });
            }

            // Find best canned match (exact first, then simple contains heuristic)
            if (!CannedResponses.TryGetValue(trimmed, out var response))
            {
                var heuristic = CannedResponses.Keys.FirstOrDefault(k => trimmed.Contains(k, StringComparison.OrdinalIgnoreCase));
                response = heuristic != null ? CannedResponses[heuristic] :
                    "Try a modern gateway: Ticket to Ride, Azul or Splendor – accessible and replayable.";
            }

            return Task.FromResult(new AgentResponse
            {
                ResponseText = response,
                ThreadId = threadId ?? $"thread_{Guid.NewGuid():N}",
                MatchingGamesCount = 0
            });
        }
    }
}
