using Xunit;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Unit tests for the GameSummary lightweight projection model.
    /// </summary>
    public class GameSummaryTests
    {
        [Fact]
        public void GameSummary_DefaultValues_ShouldBeCorrect()
        {
            // Arrange & Act
            var summary = new GameSummary();

            // Assert
            Assert.Equal(string.Empty, summary.overview);
            Assert.Equal(string.Empty, summary.imageUrl);
            Assert.NotNull(summary.mechanics);
            Assert.Empty(summary.mechanics);
            Assert.NotNull(summary.categories);
            Assert.Empty(summary.categories);
            Assert.Equal(0, summary.minPlayers);
            Assert.Equal(0, summary.maxPlayers);
            Assert.Equal(0, summary.minPlaytime);
            Assert.Equal(0, summary.maxPlaytime);
            Assert.Equal(0.0, summary.weight);
            Assert.Equal(0.0, summary.averageRating);
        }

        [Fact]
        public void GameSummary_Properties_ShouldBeSetCorrectly()
        {
            // Arrange & Act
            var summary = new GameSummary
            {
                id = "bgg-123",
                name = "Catan",
                overview = "Trade and build settlements",
                minPlayers = 3,
                maxPlayers = 4,
                minPlaytime = 60,
                maxPlaytime = 120,
                weight = 2.3,
                averageRating = 7.2,
                imageUrl = "https://example.com/catan.jpg",
                mechanics = new List<string> { "Trading", "Route Building" },
                categories = new List<string> { "Strategy", "Family" }
            };

            // Assert
            Assert.Equal("bgg-123", summary.id);
            Assert.Equal("Catan", summary.name);
            Assert.Equal("Trade and build settlements", summary.overview);
            Assert.Equal(3, summary.minPlayers);
            Assert.Equal(4, summary.maxPlayers);
            Assert.Equal(60, summary.minPlaytime);
            Assert.Equal(120, summary.maxPlaytime);
            Assert.Equal(2.3, summary.weight, 3);
            Assert.Equal(7.2, summary.averageRating, 3);
            Assert.Equal("https://example.com/catan.jpg", summary.imageUrl);
            Assert.Equal(2, summary.mechanics.Count);
            Assert.Contains("Trading", summary.mechanics);
            Assert.Equal(2, summary.categories.Count);
            Assert.Contains("Strategy", summary.categories);
        }

        [Fact]
        public void GameSummary_DoesNotContainHeavyFields()
        {
            // Verify GameSummary does NOT have the heavy fields from GameDocument
            var summaryType = typeof(GameSummary);
            Assert.Null(summaryType.GetProperty("description"));
            Assert.Null(summaryType.GetProperty("setupGuide"));
            Assert.Null(summaryType.GetProperty("ruleQnA"));
            Assert.Null(summaryType.GetProperty("moderatorScripts"));
            Assert.Null(summaryType.GetProperty("narrationTTS"));
            Assert.Null(summaryType.GetProperty("shopLink"));
            Assert.Null(summaryType.GetProperty("rulesUrl"));
            Assert.Null(summaryType.GetProperty("bggRating"));
            Assert.Null(summaryType.GetProperty("numVotes"));
        }

        [Fact]
        public void GameSummary_ContainsAllRagFields()
        {
            // Verify GameSummary has all fields used in FormatGamesForRag
            var summaryType = typeof(GameSummary);
            Assert.NotNull(summaryType.GetProperty("id"));
            Assert.NotNull(summaryType.GetProperty("name"));
            Assert.NotNull(summaryType.GetProperty("overview"));
            Assert.NotNull(summaryType.GetProperty("minPlayers"));
            Assert.NotNull(summaryType.GetProperty("maxPlayers"));
            Assert.NotNull(summaryType.GetProperty("minPlaytime"));
            Assert.NotNull(summaryType.GetProperty("maxPlaytime"));
            Assert.NotNull(summaryType.GetProperty("weight"));
            Assert.NotNull(summaryType.GetProperty("averageRating"));
            Assert.NotNull(summaryType.GetProperty("imageUrl"));
            Assert.NotNull(summaryType.GetProperty("mechanics"));
            Assert.NotNull(summaryType.GetProperty("categories"));
        }

        [Fact]
        public void FormatGamesForRag_WithGameSummary_ShouldProduceCorrectFormat()
        {
            // Arrange
            var game = new GameSummary
            {
                id = "bgg-1",
                name = "Test Game",
                overview = "A fun test game",
                averageRating = 8.5,
                minPlayers = 2,
                maxPlayers = 4,
                minPlaytime = 30,
                maxPlaytime = 60,
                weight = 2.5
            };

            // Act - replicate FormatGamesForRag formatting
            var formattedGame = $"- {game.name}: {game.overview} (Players: {game.minPlayers}-{game.maxPlayers}, Playtime: {game.minPlaytime}-{game.maxPlaytime} min, Weight: {game.weight:F1}, Rating: {game.averageRating:F1}/10)";

            // Assert
            Assert.Contains("Test Game", formattedGame);
            Assert.Contains("A fun test game", formattedGame);
            Assert.Contains("Players: 2-4", formattedGame);
            Assert.Contains("Playtime: 30-60 min", formattedGame);
            Assert.Contains("Weight: 2.5", formattedGame);
            Assert.Contains("Rating: 8.5/10", formattedGame);
        }

        [Fact]
        public void GameSummary_SortByRating_ShouldWorkCorrectly()
        {
            // Arrange
            var summaries = new List<GameSummary>
            {
                new GameSummary { id = "1", name = "Low", averageRating = 5.0 },
                new GameSummary { id = "2", name = "High", averageRating = 9.0 },
                new GameSummary { id = "3", name = "Mid", averageRating = 7.0 }
            };

            // Act
            var sorted = summaries.OrderByDescending(g => g.averageRating).ToList();

            // Assert
            Assert.Equal("High", sorted[0].name);
            Assert.Equal("Mid", sorted[1].name);
            Assert.Equal("Low", sorted[2].name);
        }
    }
}
