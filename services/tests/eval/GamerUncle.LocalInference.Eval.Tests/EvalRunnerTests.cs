using GamerUncle.LocalInference.Eval.Extractors;
using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.LocalInference.Eval.Scoring;
using GamerUncle.Shared.Models;
using Xunit;

namespace GamerUncle.LocalInference.Eval.Tests
{
    public class EvalRunnerTests
    {
        private static List<GameDocument> Games() => new()
        {
            new GameDocument
            {
                id = "bgg-1", name = "Pandemic",
                minPlayers = 2, maxPlayers = 4, minPlaytime = 45, maxPlaytime = 45,
                weight = 2.4, averageRating = 7.6, numVotes = 100, ageRequirement = 8,
                mechanics = new List<string> { "Cooperative" },
                categories = new List<string> { "Strategy" }
            }
        };

        [Fact]
        public async Task Aggregates_ExactMatchRate_And_NullCount()
        {
            var gold = new List<GoldEntry>
            {
                new() { Id = "a", Query = "q1", Gold = new GameQueryCriteria { MinPlayers = 2, MaxPlayers = 4 } },
                new() { Id = "b", Query = "q2", Gold = new GameQueryCriteria { MinPlayers = 3, MaxPlayers = 5 } },
            };

            var predictions = new List<PredictionEntry>
            {
                new() { Id = "a", Predicted = new GameQueryCriteria { MinPlayers = 2, MaxPlayers = 4 } },
                // "b" has no prediction -> null (hard failure).
            };

            var extractor = new ReplayExtractor("test", predictions);
            var card = await EvalRunner.RunAsync(gold, extractor, Games());

            Assert.Equal(2, card.EntryCount);
            Assert.Equal(1, card.NullPredictionCount);
            Assert.Equal(0.5, card.ExactMatchRate, 3);
        }

        [Fact]
        public async Task PopulatesLatency_WhenPredictionsCarryLatency()
        {
            var gold = new List<GoldEntry>
            {
                new() { Id = "a", Query = "q1", Gold = new GameQueryCriteria { name = "Pandemic" } },
            };
            var predictions = new List<PredictionEntry>
            {
                new() { Id = "a", Predicted = new GameQueryCriteria { name = "Pandemic" }, LatencyMs = 500 },
            };

            var card = await EvalRunner.RunAsync(gold, new ReplayExtractor("t", predictions), Games());

            Assert.NotNull(card.Latency);
            Assert.Equal(500, card.Latency!.P50Ms, 3);
            Assert.Equal(1, card.Latency.SampleCount);
        }

        [Fact]
        public void BuildSetMetric_EmptyCounts_YieldPerfectPrecisionRecall()
        {
            var metric = EvalRunner.BuildSetMetric(0, 0, 0);
            Assert.Equal(1.0, metric.Precision, 3);
            Assert.Equal(1.0, metric.Recall, 3);
        }

        [Fact]
        public void BuildSetMetric_ComputesF1()
        {
            var metric = EvalRunner.BuildSetMetric(tp: 6, fp: 2, fn: 2);
            Assert.Equal(0.75, metric.Precision, 3);
            Assert.Equal(0.75, metric.Recall, 3);
            Assert.Equal(0.75, metric.F1, 3);
        }

        [Theory]
        [InlineData(50, 3.0)]
        [InlineData(0, 1.0)]
        [InlineData(100, 5.0)]
        public void Percentile_InterpolatesLinearly(double percentile, double expected)
        {
            var values = new List<double> { 1.0, 2.0, 3.0, 4.0, 5.0 };
            Assert.Equal(expected, EvalRunner.Percentile(values, percentile), 3);
        }
    }
}
