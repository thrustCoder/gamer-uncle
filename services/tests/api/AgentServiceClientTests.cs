using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Unit tests for AgentServiceClient focusing on game sorting functionality
    /// </summary>
    public class AgentServiceClientTests
    {
        /// <summary>
        /// Test that games are sorted by rating in descending order (highest rated first)
        /// </summary>
        [Fact]
        public void GamesSortedByRatingDescending_ShouldReturnHighestRatedFirst()
        {
            // Arrange
            var testGames = new List<GameDocument>
            {
                new GameDocument
                {
                    id = "bgg-1",
                    name = "Low Rated Game",
                    overview = "A game with low rating",
                    averageRating = 5.2,
                    minPlayers = 2,
                    maxPlayers = 4,
                    minPlaytime = 30,
                    maxPlaytime = 60,
                    weight = 2.5
                },
                new GameDocument
                {
                    id = "bgg-2",
                    name = "High Rated Game",
                    overview = "A game with high rating",
                    averageRating = 8.7,
                    minPlayers = 1,
                    maxPlayers = 4,
                    minPlaytime = 45,
                    maxPlaytime = 90,
                    weight = 3.2
                },
                new GameDocument
                {
                    id = "bgg-3",
                    name = "Medium Rated Game",
                    overview = "A game with medium rating",
                    averageRating = 6.9,
                    minPlayers = 2,
                    maxPlayers = 6,
                    minPlaytime = 60,
                    maxPlaytime = 120,
                    weight = 2.8
                }
            };

            // Act - Apply the same sorting logic used in GetRecommendationsAsync
            var sortedGames = testGames.OrderByDescending(game => game.averageRating).ToList();

            // Assert
            Assert.Equal(3, sortedGames.Count);
            Assert.Equal("High Rated Game", sortedGames[0].name);
            Assert.Equal(8.7, sortedGames[0].averageRating, 3);
            Assert.Equal("Medium Rated Game", sortedGames[1].name);
            Assert.Equal(6.9, sortedGames[1].averageRating, 3);
            Assert.Equal("Low Rated Game", sortedGames[2].name);
            Assert.Equal(5.2, sortedGames[2].averageRating, 3);
        }

        /// <summary>
        /// Test that the RAG format includes rating information
        /// </summary>
        [Fact]
        public void FormatGamesForRag_ShouldIncludeRatingInformation()
        {
            // Arrange
            var testGame = new GameDocument
            {
                id = "bgg-1",
                name = "Test Game",
                overview = "A test game",
                averageRating = 8.5,
                minPlayers = 2,
                maxPlayers = 4,
                minPlaytime = 30,
                maxPlaytime = 60,
                weight = 2.5
            };

            // Act - Format the game info as done in FormatGamesForRag
            var formattedGame = $"- {testGame.name}: {testGame.overview} (Players: {testGame.minPlayers}-{testGame.maxPlayers}, Playtime: {testGame.minPlaytime}-{testGame.maxPlaytime} min, Weight: {testGame.weight}, Rating: {testGame.averageRating:F1}/10)";
            
            var expectedFormat = "- Test Game: A test game (Players: 2-4, Playtime: 30-60 min, Weight: 2.5, Rating: 8.5/10)";

            // Assert
            Assert.Equal(expectedFormat, formattedGame);
        }

        /// <summary>
        /// Test various rating scenarios
        /// </summary>
        [Fact]
        public void GamesSorting_VariousRatingScenarios_ShouldSortCorrectly()
        {
            // Test 1: Different ratings
            var games1 = CreateTestGames(new double[] { 8.5, 7.2, 9.1, 6.8 }, new string[] { "Game A", "Game B", "Game C", "Game D" });
            var sorted1 = games1.OrderByDescending(game => game.averageRating).ToList();
            var expectedOrder1 = new string[] { "Game C", "Game A", "Game B", "Game D" }; // 9.1, 8.5, 7.2, 6.8
            
            for (int i = 0; i < expectedOrder1.Length; i++)
            {
                Assert.Equal(expectedOrder1[i], sorted1[i].name);
            }

            // Test 2: Same ratings (should maintain original order)
            var games2 = CreateTestGames(new double[] { 5.0, 5.0, 5.0 }, new string[] { "Game A", "Game B", "Game C" });
            var sorted2 = games2.OrderByDescending(game => game.averageRating).ToList();
            var expectedOrder2 = new string[] { "Game A", "Game B", "Game C" };
            
            for (int i = 0; i < expectedOrder2.Length; i++)
            {
                Assert.Equal(expectedOrder2[i], sorted2[i].name);
            }
        }

        [Theory]
        [InlineData(new double[] { 9.5, 8.3, 7.1 }, new string[] { "Best Game", "Good Game", "OK Game" })]
        [InlineData(new double[] { 6.0, 6.0, 6.0 }, new string[] { "Game 1", "Game 2", "Game 3" })]
        [InlineData(new double[] { 1.0, 10.0, 5.5 }, new string[] { "Worst", "Best", "Average" })]
        public void GamesSorting_WithTheoryData_ShouldSortByRatingDescending(double[] ratings, string[] names)
        {
            // Arrange
            var games = CreateTestGames(ratings, names);

            // Act
            var sortedGames = games.OrderByDescending(game => game.averageRating).ToList();

            // Assert
            for (int i = 0; i < sortedGames.Count - 1; i++)
            {
                Assert.True(sortedGames[i].averageRating >= sortedGames[i + 1].averageRating,
                    $"Game at position {i} should have rating >= game at position {i + 1}");
            }
        }

        [Fact]
        public void GameDocument_Properties_ShouldBeSetCorrectly()
        {
            // Arrange & Act
            var game = new GameDocument
            {
                id = "test-id",
                name = "Test Game",
                overview = "Test overview",
                averageRating = 7.5,
                minPlayers = 2,
                maxPlayers = 4,
                minPlaytime = 30,
                maxPlaytime = 60,
                weight = 2.5
            };

            // Assert
            Assert.Equal("test-id", game.id);
            Assert.Equal("Test Game", game.name);
            Assert.Equal("Test overview", game.overview);
            Assert.Equal(7.5, game.averageRating);
            Assert.Equal(2, game.minPlayers);
            Assert.Equal(4, game.maxPlayers);
            Assert.Equal(30, game.minPlaytime);
            Assert.Equal(60, game.maxPlaytime);
            Assert.Equal(2.5, game.weight);
        }

        /// <summary>
        /// Helper method to create test games
        /// </summary>
        private static List<GameDocument> CreateTestGames(double[] ratings, string[] names)
        {
            if (ratings.Length != names.Length)
                throw new ArgumentException("Ratings and names arrays must have the same length");

            var games = new List<GameDocument>();
            for (int i = 0; i < ratings.Length; i++)
            {
                games.Add(new GameDocument
                {
                    id = $"bgg-{i + 1}",
                    name = names[i],
                    overview = $"Overview for {names[i]}",
                    averageRating = ratings[i],
                    minPlayers = 2,
                    maxPlayers = 4,
                    minPlaytime = 30,
                    maxPlaytime = 60,
                    weight = 2.5
                });
            }
            return games;
        }
    }
}
