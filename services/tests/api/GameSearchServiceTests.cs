using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using Xunit;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.GameSearch;

namespace GamerUncle.Api.Tests
{
    public class GameSearchServiceTests
    {
        private static GameSearchService CreateService(
            IMemoryCache? memoryCache = null,
            IConnectionMultiplexer? redis = null,
            bool isTestEnvironment = true)
        {
            memoryCache ??= new MemoryCache(new MemoryCacheOptions());

            var configMock = new Mock<IConfiguration>();
            configMock.Setup(c => c.GetSection("CriteriaCache:L1ExpirationMinutes").Value).Returns("10");
            configMock.Setup(c => c.GetSection("CriteriaCache:L2ExpirationMinutes").Value).Returns("30");
            configMock.Setup(c => c.GetSection("CriteriaCache:Environment").Value).Returns("test");
            configMock.Setup(c => c.GetSection("Testing:DisableRateLimit").Value)
                .Returns(isTestEnvironment ? "true" : "false");

            var loggerMock = new Mock<ILogger<GameSearchService>>();

            var environmentMock = new Mock<IWebHostEnvironment>();
            environmentMock.Setup(e => e.EnvironmentName)
                .Returns(isTestEnvironment ? "Testing" : "Development");

            return new GameSearchService(
                configMock.Object,
                memoryCache,
                redis,
                loggerMock.Object,
                environmentMock.Object);
        }

        #region SearchGamesAsync Tests

        [Fact]
        public async Task SearchGamesAsync_QueryTooShort_ReturnsEmptyResults()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.SearchGamesAsync("ab"); // Less than 3 chars

            // Assert
            Assert.NotNull(result);
            Assert.Empty(result.Results);
            Assert.Equal(0, result.TotalCount);
        }

        [Fact]
        public async Task SearchGamesAsync_EmptyQuery_ReturnsEmptyResults()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.SearchGamesAsync("");

            // Assert
            Assert.NotNull(result);
            Assert.Empty(result.Results);
        }

        [Fact]
        public async Task SearchGamesAsync_NullQuery_ReturnsEmptyResults()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.SearchGamesAsync(null!);

            // Assert
            Assert.NotNull(result);
            Assert.Empty(result.Results);
        }

        [Fact]
        public async Task SearchGamesAsync_ValidQuery_ReturnsTestData()
        {
            // Arrange
            var service = CreateService();

            // Act - search for "catan" which should match test data
            var result = await service.SearchGamesAsync("catan");

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Results);
            Assert.Equal("Catan", result.Results[0].Name);
            Assert.Equal("bgg-13", result.Results[0].Id);
        }

        [Fact]
        public async Task SearchGamesAsync_PartialMatch_ReturnsMatchingGames()
        {
            // Arrange
            var service = CreateService();

            // Act - search for "pan" which should match "Pandemic"
            var result = await service.SearchGamesAsync("pan");

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Results);
            Assert.Equal("Pandemic", result.Results[0].Name);
        }

        [Fact]
        public async Task SearchGamesAsync_NoMatches_ReturnsEmptyList()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.SearchGamesAsync("xyznonexistent");

            // Assert
            Assert.NotNull(result);
            Assert.Empty(result.Results);
            Assert.Equal(0, result.TotalCount);
        }

        [Fact]
        public async Task SearchGamesAsync_RespectMaxResults()
        {
            // Arrange
            var service = CreateService();

            // Act - search for "a" which might match multiple test games
            var result = await service.SearchGamesAsync("mars", maxResults: 1);

            // Assert
            Assert.NotNull(result);
            Assert.True(result.Results.Count <= 1);
        }

        [Fact]
        public async Task SearchGamesAsync_CacheL1_SecondCallUsesCache()
        {
            // Arrange
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var service = CreateService(memoryCache);

            // Act - First call
            var result1 = await service.SearchGamesAsync("catan");

            // Act - Second call (should use L1 cache)
            var result2 = await service.SearchGamesAsync("catan");

            // Assert
            Assert.NotNull(result1);
            Assert.NotNull(result2);
            Assert.Equal(result1.Results.Count, result2.Results.Count);
        }

        [Theory]
        [InlineData("CATAN")]
        [InlineData("Catan")]
        [InlineData("catan")]
        [InlineData("CaTaN")]
        public async Task SearchGamesAsync_CaseInsensitive_AllCasesReturnSameResults(string query)
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.SearchGamesAsync(query);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Results);
            Assert.Equal("Catan", result.Results[0].Name);
        }

        #endregion

        #region GetGameDetailsAsync Tests

        [Fact]
        public async Task GetGameDetailsAsync_ValidId_ReturnsGameDetails()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.GetGameDetailsAsync("bgg-13");

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Catan", result.Name);
            Assert.Equal("bgg-13", result.Id);
            Assert.Equal(7.1, result.AverageRating);
            Assert.Equal(3, result.MinPlayers);
            Assert.Equal(4, result.MaxPlayers);
            Assert.Equal(10, result.AgeRequirement);
            Assert.NotNull(result.RulesUrl);
        }

        [Fact]
        public async Task GetGameDetailsAsync_EmptyId_ReturnsNull()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.GetGameDetailsAsync("");

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task GetGameDetailsAsync_NullId_ReturnsNull()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.GetGameDetailsAsync(null!);

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task GetGameDetailsAsync_InvalidId_ReturnsNull()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.GetGameDetailsAsync("bgg-nonexistent");

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task GetGameDetailsAsync_CacheL1_SecondCallUsesCache()
        {
            // Arrange
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var service = CreateService(memoryCache);

            // Act - First call
            var result1 = await service.GetGameDetailsAsync("bgg-13");

            // Act - Second call (should use L1 cache)
            var result2 = await service.GetGameDetailsAsync("bgg-13");

            // Assert
            Assert.NotNull(result1);
            Assert.NotNull(result2);
            Assert.Equal(result1.Name, result2.Name);
        }

        [Fact]
        public async Task GetGameDetailsAsync_ReturnsAllExpectedFields()
        {
            // Arrange
            var service = CreateService();

            // Act
            var result = await service.GetGameDetailsAsync("bgg-13");

            // Assert
            Assert.NotNull(result);
            Assert.False(string.IsNullOrEmpty(result.Id));
            Assert.False(string.IsNullOrEmpty(result.Name));
            Assert.False(string.IsNullOrEmpty(result.Overview));
            Assert.True(result.AverageRating > 0);
            Assert.True(result.BggRating > 0);
            Assert.True(result.NumVotes > 0);
            Assert.True(result.MinPlayers > 0);
            Assert.True(result.MaxPlayers > 0);
            Assert.True(result.AgeRequirement >= 0);
            Assert.NotNull(result.Mechanics);
            Assert.NotNull(result.Categories);
        }

        #endregion
    }
}
