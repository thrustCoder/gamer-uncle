using GamerUncle.LocalInference.Eval.Scoring;
using GamerUncle.Shared.Models;
using Xunit;

namespace GamerUncle.LocalInference.Eval.Tests
{
    public class CriteriaScorerTests
    {
        [Fact]
        public void NullPrediction_DisagreesEverywhere_AndNotExact()
        {
            // Gold populates every field type so a null prediction genuinely disagrees on all of them.
            var gold = new GameQueryCriteria
            {
                name = "Catan",
                MinPlayers = 2,
                MaxPlayers = 4,
                MinPlaytime = 30,
                MaxPlaytime = 60,
                Mechanics = new[] { "Trading" },
                Categories = new[] { "Family" },
                MaxWeight = 2.5,
                averageRating = 7.0,
                ageRequirement = 10
            };

            var result = CriteriaScorer.Score(gold, null);

            Assert.True(result.PredictionWasNull);
            Assert.False(result.ExactMatch);
            Assert.All(result.FieldAgreement.Values, v => Assert.False(v));
        }

        [Fact]
        public void IdenticalCriteria_IsExactMatch()
        {
            var gold = new GameQueryCriteria
            {
                MinPlayers = 2,
                MaxPlayers = 4,
                Mechanics = new[] { "Cooperative" }
            };
            var pred = new GameQueryCriteria
            {
                MinPlayers = 2,
                MaxPlayers = 4,
                Mechanics = new[] { "cooperative" } // case-insensitive set match
            };

            var result = CriteriaScorer.Score(gold, pred);

            Assert.True(result.ExactMatch);
            Assert.All(result.FieldAgreement.Values, Assert.True);
        }

        [Fact]
        public void IntAgree_NullEqualsNull_ButNullNotEqualsValue()
        {
            Assert.True(CriteriaScorer.IntAgree(null, null));
            Assert.True(CriteriaScorer.IntAgree(3, 3));
            Assert.False(CriteriaScorer.IntAgree(3, null));
            Assert.False(CriteriaScorer.IntAgree(null, 3));
            Assert.False(CriteriaScorer.IntAgree(3, 4));
        }

        [Theory]
        [InlineData(2.0, 2.25, true)]   // within tolerance (0.25)
        [InlineData(2.0, 2.26, false)]  // just outside tolerance
        [InlineData(null, null, true)]
        [InlineData(2.0, null, false)]
        public void DoubleAgree_HonorsTolerance(double? a, double? b, bool expected)
        {
            Assert.Equal(expected, CriteriaScorer.DoubleAgree(a, b));
        }

        [Fact]
        public void NameAgree_NormalizesWhitespaceAndCase()
        {
            Assert.True(CriteriaScorer.NameAgree("Ticket to Ride", "  ticket   to ride "));
            Assert.False(CriteriaScorer.NameAgree("Catan", "Carcassonne"));
            Assert.True(CriteriaScorer.NameAgree(null, "   "));
            Assert.False(CriteriaScorer.NameAgree("Catan", null));
        }

        [Fact]
        public void SetCounts_ComputesTpFpFn_CaseInsensitive()
        {
            var gold = new[] { "Deck Building", "Card Drafting" };
            var pred = new[] { "deck building", "Engine Building" };

            var counts = CriteriaScorer.SetCounts(gold, pred);

            Assert.Equal(1, counts.TruePositives);  // deck building
            Assert.Equal(1, counts.FalsePositives);  // engine building
            Assert.Equal(1, counts.FalseNegatives);  // card drafting
            Assert.False(counts.ExactMatch);
        }

        [Fact]
        public void SetCounts_EmptyBoth_IsExactMatch()
        {
            var counts = CriteriaScorer.SetCounts(null, null);
            Assert.Equal(0, counts.TruePositives);
            Assert.Equal(0, counts.FalsePositives);
            Assert.Equal(0, counts.FalseNegatives);
            Assert.True(counts.ExactMatch);
        }
    }
}
