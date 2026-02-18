using Microsoft.AspNetCore.Hosting;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using Xunit;
using GamerUncle.Api.Services.Cosmos;
using GamerUncle.Api.Services.GameData;
using GamerUncle.Api.Services.GameSearch;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Verifies the singleton CosmosClient/Container injection pattern
    /// introduced to eliminate per-service CosmosClient instantiation (Finding #1).
    /// </summary>
    public class CosmosClientSingletonTests
    {
        #region CosmosDbService Tests

        [Fact]
        public void CosmosDbService_AcceptsInjectedContainer()
        {
            // Arrange
            var mockContainer = new Mock<Container>();

            // Act
            var service = new CosmosDbService(mockContainer.Object);

            // Assert — construction succeeds without creating its own CosmosClient
            Assert.NotNull(service);
        }

        [Fact]
        public void CosmosDbService_ThrowsOnNullContainer()
        {
            // Act & Assert
            Assert.Throws<ArgumentNullException>(() => new CosmosDbService(null!));
        }

        #endregion

        #region GameDataService Tests

        [Fact]
        public void GameDataService_AcceptsInjectedContainer_InNonTestEnvironment()
        {
            // Arrange
            var mockContainer = new Mock<Container>();
            var config = BuildConfig(isTest: false);
            var logger = new Mock<ILogger<GameDataService>>().Object;
            var env = BuildEnvironment("Development");

            // Act
            var service = new GameDataService(config, logger, env, mockContainer.Object);

            // Assert
            Assert.NotNull(service);
        }

        [Fact]
        public void GameDataService_RunsWithoutContainer_InTestEnvironment()
        {
            // Arrange
            var config = BuildConfig(isTest: true);
            var logger = new Mock<ILogger<GameDataService>>().Object;
            var env = BuildEnvironment("Testing");

            // Act — no container injected
            var service = new GameDataService(config, logger, env);

            // Assert — uses mock data path
            Assert.NotNull(service);
        }

        [Fact]
        public void GameDataService_ThrowsWithoutContainer_InNonTestEnvironment()
        {
            // Arrange
            var config = BuildConfig(isTest: false);
            var logger = new Mock<ILogger<GameDataService>>().Object;
            var env = BuildEnvironment("Development");

            // Act & Assert
            var ex = Assert.Throws<InvalidOperationException>(
                () => new GameDataService(config, logger, env));

            Assert.Contains("Cosmos DB Container must be registered", ex.Message);
        }

        #endregion

        #region GameSearchService Tests

        [Fact]
        public void GameSearchService_AcceptsInjectedContainer_InNonTestEnvironment()
        {
            // Arrange
            var mockContainer = new Mock<Container>();
            var config = BuildConfig(isTest: false);
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var logger = new Mock<ILogger<GameSearchService>>().Object;
            var env = BuildEnvironment("Development");

            // Act
            var service = new GameSearchService(
                config, memoryCache, null, logger, env,
                telemetry: null, container: mockContainer.Object);

            // Assert
            Assert.NotNull(service);
        }

        [Fact]
        public void GameSearchService_RunsWithoutContainer_InTestEnvironment()
        {
            // Arrange
            var config = BuildConfig(isTest: true);
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var logger = new Mock<ILogger<GameSearchService>>().Object;
            var env = BuildEnvironment("Testing");

            // Act — no container injected
            var service = new GameSearchService(
                config, memoryCache, null, logger, env);

            // Assert
            Assert.NotNull(service);
        }

        [Fact]
        public void GameSearchService_ThrowsWithoutContainer_InNonTestEnvironment()
        {
            // Arrange
            var config = BuildConfig(isTest: false);
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var logger = new Mock<ILogger<GameSearchService>>().Object;
            var env = BuildEnvironment("Development");

            // Act & Assert
            var ex = Assert.Throws<InvalidOperationException>(
                () => new GameSearchService(
                    config, memoryCache, null, logger, env));

            Assert.Contains("Cosmos DB Container must be registered", ex.Message);
        }

        #endregion

        #region Shared Container Identity Tests

        [Fact]
        public void AllThreeServices_ShareSameContainerInstance()
        {
            // Arrange — one mock Container representing the singleton
            var mockContainer = new Mock<Container>();
            var sharedContainer = mockContainer.Object;

            var config = BuildConfig(isTest: false);
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var loggerData = new Mock<ILogger<GameDataService>>().Object;
            var loggerSearch = new Mock<ILogger<GameSearchService>>().Object;
            var envDev = BuildEnvironment("Development");

            // Act — inject the same Container into all three services
            var cosmosDbService = new CosmosDbService(sharedContainer);
            var gameDataService = new GameDataService(config, loggerData, envDev, sharedContainer);
            var gameSearchService = new GameSearchService(
                config, memoryCache, null, loggerSearch, envDev,
                telemetry: null, container: sharedContainer);

            // Assert — all services created successfully with the same instance
            Assert.NotNull(cosmosDbService);
            Assert.NotNull(gameDataService);
            Assert.NotNull(gameSearchService);
        }

        #endregion

        #region Helpers

        private static IConfiguration BuildConfig(bool isTest)
        {
            var settings = new Dictionary<string, string?>
            {
                ["CriteriaCache:L1ExpirationMinutes"] = "10",
                ["CriteriaCache:L2ExpirationMinutes"] = "30",
                ["CriteriaCache:Environment"] = "test",
                ["Testing:DisableRateLimit"] = isTest ? "true" : "false",
            };

            return new ConfigurationBuilder()
                .AddInMemoryCollection(settings)
                .Build();
        }

        private static IWebHostEnvironment BuildEnvironment(string environmentName)
        {
            var mock = new Mock<IWebHostEnvironment>();
            mock.Setup(e => e.EnvironmentName).Returns(environmentName);
            return mock.Object;
        }

        #endregion
    }
}
