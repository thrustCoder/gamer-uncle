using System.Globalization;
using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval.Scoring
{
    /// <summary>
    /// In-memory re-implementation of the query semantics in
    /// <c>CosmosDbService.BuildWhereClause</c>. Kept intentionally faithful so that recall@k
    /// measured here reflects what the live Cosmos query would return for the same criteria.
    /// Operates over a static <see cref="GameDocument"/> snapshot for deterministic, offline scoring.
    ///
    /// If the semantics of BuildWhereClause change, update this matcher and its tests together.
    /// </summary>
    public static class CriteriaMatcher
    {
        /// <summary>Returns every game in <paramref name="games"/> that satisfies <paramref name="criteria"/>.</summary>
        public static List<GameDocument> Match(GameQueryCriteria criteria, IReadOnlyList<GameDocument> games)
            => games.Where(g => Matches(criteria, g)).ToList();

        /// <summary>
        /// Returns matched games ranked the way the app surfaces them: highest averageRating first,
        /// then most-voted, then id for a stable order. Mirrors the "ORDER BY averageRating DESC" shape.
        /// </summary>
        public static List<GameDocument> MatchRanked(GameQueryCriteria criteria, IReadOnlyList<GameDocument> games)
            => Match(criteria, games)
                .OrderByDescending(g => g.averageRating)
                .ThenByDescending(g => g.numVotes)
                .ThenBy(g => g.id, StringComparer.Ordinal)
                .ToList();

        public static bool Matches(GameQueryCriteria c, GameDocument g)
        {
            // name: CONTAINS(LOWER(c.name), LOWER(@name))
            if (!string.IsNullOrEmpty(c.name))
            {
                if (!g.name.ToLowerInvariant().Contains(c.name.ToLowerInvariant()))
                    return false;
            }

            // Player count range-overlap logic.
            if (c.MinPlayers.HasValue && c.MaxPlayers.HasValue)
            {
                if (!(g.maxPlayers >= c.MinPlayers.Value && g.minPlayers <= c.MaxPlayers.Value)) return false;
            }
            else if (c.MinPlayers.HasValue)
            {
                if (!(g.maxPlayers >= c.MinPlayers.Value)) return false;
            }
            else if (c.MaxPlayers.HasValue)
            {
                if (!(g.minPlayers <= c.MaxPlayers.Value)) return false;
            }

            // Playtime range-overlap logic.
            if (c.MinPlaytime.HasValue && c.MaxPlaytime.HasValue)
            {
                if (!(g.maxPlaytime >= c.MinPlaytime.Value && g.minPlaytime <= c.MaxPlaytime.Value)) return false;
            }
            else if (c.MinPlaytime.HasValue)
            {
                if (!(g.maxPlaytime >= c.MinPlaytime.Value)) return false;
            }
            else if (c.MaxPlaytime.HasValue)
            {
                if (!(g.minPlaytime <= c.MaxPlaytime.Value)) return false;
            }

            if (c.MaxWeight.HasValue && !(g.weight <= c.MaxWeight.Value)) return false;
            if (c.averageRating.HasValue && !(g.averageRating >= c.averageRating.Value)) return false;
            if (c.ageRequirement.HasValue && !(g.ageRequirement <= c.ageRequirement.Value)) return false;

            // Mechanics + Categories: game matches if ANY search term appears in either array.
            var terms = new List<string>();
            if (c.Mechanics != null) terms.AddRange(c.Mechanics.Select(ToTitleCase));
            if (c.Categories != null) terms.AddRange(c.Categories.Select(ToTitleCase));
            terms = terms.Where(t => !string.IsNullOrWhiteSpace(t)).ToList();

            if (terms.Count > 0)
            {
                bool any = terms.Any(t =>
                    ContainsIgnoreCase(g.mechanics, t) || ContainsIgnoreCase(g.categories, t));
                if (!any) return false;
            }

            return true;
        }

        private static bool ContainsIgnoreCase(IEnumerable<string> haystack, string term)
            => haystack.Any(h => string.Equals(h, term, StringComparison.OrdinalIgnoreCase));

        // Mirrors CosmosDbService.ToTitleCase.
        private static string ToTitleCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            var textInfo = CultureInfo.CurrentCulture.TextInfo;
            return textInfo.ToTitleCase(input.ToLowerInvariant());
        }
    }
}
