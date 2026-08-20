using GamerUncle.LocalInference.Eval.Scoring;
using GamerUncle.Shared.Models;
using Xunit;

namespace GamerUncle.LocalInference.Eval.Tests
{
    public class CriteriaMatcherTests
    {
        private static GameDocument Game(
            string id, string name,
            int minP, int maxP, int minT, int maxT,
            double weight, double rating, int votes, int age,
            string[]? mechanics = null, string[]? categories = null) =>
            new GameDocument
            {
                id = id,
                name = name,
                minPlayers = minP,
                maxPlayers = maxP,
                minPlaytime = minT,
                maxPlaytime = maxT,
                weight = weight,
                averageRating = rating,
                numVotes = votes,
                ageRequirement = age,
                mechanics = (mechanics ?? Array.Empty<string>()).ToList(),
                categories = (categories ?? Array.Empty<string>()).ToList()
            };

        private static List<GameDocument> Snapshot() => new()
        {
            Game("bgg-1", "Catan", 3, 4, 60, 120, 2.3, 7.1, 100, 10,
                mechanics: new[] { "Dice Rolling", "Trading" }, categories: new[] { "Family" }),
            Game("bgg-2", "Pandemic", 2, 4, 45, 45, 2.4, 7.6, 200, 8,
                mechanics: new[] { "Cooperative" }, categories: new[] { "Strategy" }),
            Game("bgg-3", "Codenames", 2, 8, 15, 15, 1.3, 7.6, 300, 14,
                mechanics: new[] { "Team" }, categories: new[] { "Party" }),
        };

        [Fact]
        public void NameFilter_IsSubstringCaseInsensitive()
        {
            var games = Snapshot();
            var result = CriteriaMatcher.Match(new GameQueryCriteria { name = "cata" }, games);
            Assert.Single(result);
            Assert.Equal("bgg-1", result[0].id);
        }

        [Fact]
        public void PlayerRange_UsesOverlapLogic()
        {
            var games = Snapshot();
            // Exactly 6 players -> min=max=6. Only Codenames (2-8) overlaps.
            var result = CriteriaMatcher.Match(new GameQueryCriteria { MinPlayers = 6, MaxPlayers = 6 }, games);
            Assert.Single(result);
            Assert.Equal("bgg-3", result[0].id);
        }

        [Fact]
        public void MinPlayersOnly_MatchesWhenMaxPlayersReaches()
        {
            var games = Snapshot();
            // MinPlayers=5 -> game.maxPlayers >= 5 -> only Codenames (max 8).
            var result = CriteriaMatcher.Match(new GameQueryCriteria { MinPlayers = 5 }, games);
            Assert.Single(result);
            Assert.Equal("bgg-3", result[0].id);
        }

        [Fact]
        public void MaxPlaytimeOnly_MatchesShortGames()
        {
            var games = Snapshot();
            // MaxPlaytime=20 -> game.minPlaytime <= 20 -> only Codenames (15).
            var result = CriteriaMatcher.Match(new GameQueryCriteria { MaxPlaytime = 20 }, games);
            Assert.Single(result);
            Assert.Equal("bgg-3", result[0].id);
        }

        [Fact]
        public void MaxWeight_FiltersHeavyGames()
        {
            var games = Snapshot();
            var result = CriteriaMatcher.Match(new GameQueryCriteria { MaxWeight = 1.5 }, games);
            Assert.Single(result);
            Assert.Equal("bgg-3", result[0].id); // weight 1.3
        }

        [Fact]
        public void AverageRating_IsLowerBound()
        {
            var games = Snapshot();
            var result = CriteriaMatcher.Match(new GameQueryCriteria { averageRating = 7.6 }, games);
            Assert.Equal(2, result.Count); // Pandemic + Codenames (>= 7.6)
        }

        [Fact]
        public void AgeRequirement_IsUpperBound()
        {
            var games = Snapshot();
            // ageRequirement=8 -> game.ageRequirement <= 8 -> only Pandemic (8).
            var result = CriteriaMatcher.Match(new GameQueryCriteria { ageRequirement = 8 }, games);
            Assert.Single(result);
            Assert.Equal("bgg-2", result[0].id);
        }

        [Fact]
        public void MechanicsOrCategories_MatchIfAnyTermPresent()
        {
            var games = Snapshot();
            // "cooperative" mechanic OR "party" category -> Pandemic + Codenames.
            var result = CriteriaMatcher.Match(
                new GameQueryCriteria { Mechanics = new[] { "cooperative" }, Categories = new[] { "party" } },
                games);
            var ids = result.Select(g => g.id).OrderBy(x => x).ToList();
            Assert.Equal(new[] { "bgg-2", "bgg-3" }, ids);
        }

        [Fact]
        public void NoConditions_MatchesEverything()
        {
            var games = Snapshot();
            var result = CriteriaMatcher.Match(new GameQueryCriteria(), games);
            Assert.Equal(games.Count, result.Count);
        }

        [Fact]
        public void MatchRanked_OrdersByRatingThenVotes()
        {
            var games = Snapshot();
            // averageRating>=7 matches all; Pandemic & Codenames tie at 7.6 -> votes break tie (Codenames 300 > Pandemic 200).
            var result = CriteriaMatcher.MatchRanked(new GameQueryCriteria { averageRating = 7.0 }, games);
            Assert.Equal(new[] { "bgg-3", "bgg-2", "bgg-1" }, result.Select(g => g.id).ToArray());
        }
    }
}
