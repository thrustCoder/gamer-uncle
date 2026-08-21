using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.LocalInference.Eval.Scoring;
using GamerUncle.Shared.Models;
using Xunit;

namespace GamerUncle.LocalInference.Eval.Tests
{
    public class RecallScorerTests
    {
        private static GameDocument Game(string id, double rating, int votes, string[] categories) =>
            new GameDocument
            {
                id = id,
                name = id,
                minPlayers = 1,
                maxPlayers = 8,
                minPlaytime = 10,
                maxPlaytime = 200,
                weight = 2.0,
                averageRating = rating,
                numVotes = votes,
                ageRequirement = 8,
                mechanics = new List<string>(),
                categories = categories.ToList()
            };

        private static List<GameDocument> Snapshot() => new()
        {
            Game("bgg-1", 9.0, 10, new[] { "Strategy" }),
            Game("bgg-2", 8.0, 10, new[] { "Strategy" }),
            Game("bgg-3", 7.0, 10, new[] { "Party" }),
        };

        [Fact]
        public void RelevantSet_PrefersExpectedGameIds()
        {
            var entry = new GoldEntry
            {
                Id = "e1",
                Query = "q",
                Gold = new GameQueryCriteria { Categories = new[] { "Strategy" } },
                ExpectedGameIds = new List<string> { "bgg-99" }
            };

            var relevant = RecallScorer.RelevantSet(entry, Snapshot());

            Assert.Single(relevant);
            Assert.Contains("bgg-99", relevant);
        }

        [Fact]
        public void RelevantSet_FallsBackToGoldCriteriaMatch()
        {
            var entry = new GoldEntry
            {
                Id = "e1",
                Query = "q",
                Gold = new GameQueryCriteria { Categories = new[] { "Strategy" } }
            };

            var relevant = RecallScorer.RelevantSet(entry, Snapshot());

            Assert.Equal(new[] { "bgg-1", "bgg-2" }, relevant.OrderBy(x => x).ToArray());
        }

        [Fact]
        public void NoRelevantGames_YieldsNaN()
        {
            var entry = new GoldEntry
            {
                Id = "e1",
                Query = "q",
                Gold = new GameQueryCriteria { Categories = new[] { "Nonexistent" } }
            };

            var result = RecallScorer.ScoreEntry(entry, entry.Gold, Snapshot(), new[] { 1, 3 });

            Assert.All(result.Values, v => Assert.True(double.IsNaN(v)));
        }

        [Fact]
        public void PerfectPrediction_RecallRampsWithK()
        {
            var entry = new GoldEntry
            {
                Id = "e1",
                Query = "q",
                Gold = new GameQueryCriteria { Categories = new[] { "Strategy" } }
            };

            // Relevant = {bgg-1, bgg-2}. Ranked retrieval by rating: bgg-1, bgg-2.
            var result = RecallScorer.ScoreEntry(entry, entry.Gold, Snapshot(), new[] { 1, 2 });

            Assert.Equal(0.5, result[1], 3);  // top-1 covers 1 of 2 relevant
            Assert.Equal(1.0, result[2], 3);  // top-2 covers both
        }

        [Fact]
        public void NullPrediction_RetrievesNothing_RecallZero()
        {
            var entry = new GoldEntry
            {
                Id = "e1",
                Query = "q",
                Gold = new GameQueryCriteria { Categories = new[] { "Strategy" } }
            };

            var result = RecallScorer.ScoreEntry(entry, null, Snapshot(), new[] { 1, 3 });

            Assert.All(result.Values, v => Assert.Equal(0.0, v, 3));
        }
    }
}
