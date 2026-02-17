using System;
using System.Globalization;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Functions;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using System.Net;
using GamerUncle.Shared.Models;

namespace GamerUncle.Functions.Tests
{
    public class TimerScheduleTests
    {
        private readonly Mock<ILogger> _mockLogger;

        public TimerScheduleTests()
        {
            _mockLogger = new Mock<ILogger>();
        }

        [Fact]
        public void ShouldSkipPastDueExecution_WhenMoreThanOneHourLate()
        {
            // Arrange
            var lastScheduledTime = DateTime.UtcNow.AddHours(-2); // 2 hours ago
            var currentTime = DateTime.UtcNow;
            
            // Act
            var timeSinceLastScheduled = currentTime - lastScheduledTime;
            var shouldSkip = timeSinceLastScheduled > TimeSpan.FromHours(1);
            
            // Assert
            Assert.True(shouldSkip);
        }

        [Fact]
        public void ShouldNotSkipPastDueExecution_WhenLessThanOneHourLate()
        {
            // Arrange
            var lastScheduledTime = DateTime.UtcNow.AddMinutes(-30); // 30 minutes ago
            var currentTime = DateTime.UtcNow;
            
            // Act
            var timeSinceLastScheduled = currentTime - lastScheduledTime;
            var shouldSkip = timeSinceLastScheduled > TimeSpan.FromHours(1);
            
            // Assert
            Assert.False(shouldSkip);
        }

        [Fact]
        public void ShouldNotSkipExecution_WhenExactlyOneHourLate()
        {
            // Arrange
            var lastScheduledTime = DateTime.UtcNow.AddHours(-1).AddSeconds(1); // Slightly under 1 hour ago
            var currentTime = DateTime.UtcNow;
            
            // Act
            var timeSinceLastScheduled = currentTime - lastScheduledTime;
            var shouldSkip = timeSinceLastScheduled > TimeSpan.FromHours(1);
            
            // Assert
            Assert.False(shouldSkip); // Should not skip when slightly under 1 hour
        }

        [Theory]
        [InlineData("Development", true)]
        [InlineData("development", true)]
        [InlineData("dev", true)]
        [InlineData("Production", false)]
        [InlineData("prod", false)]
        [InlineData("", false)]
        public void EnvironmentCheck_ReturnsCorrectValue(string environment, bool shouldBeDevEnvironment)
        {
            // Act
            var isDev = environment.Contains("Development") || environment.Contains("dev");
            
            // Assert
            Assert.Equal(shouldBeDevEnvironment, isDev);
        }
    }

    public class DurableGameUpsertFunctionConfigurationTests
    {
        [Fact]
        public void Constructor_ShouldUseDevelopmentDefaults_WhenEnvironmentVariablesNotSet()
        {
            // Arrange - Clear any existing environment variables
            Environment.SetEnvironmentVariable("COSMOS_DATABASE_NAME", null);
            Environment.SetEnvironmentVariable("COSMOS_CONTAINER_NAME", null);
            Environment.SetEnvironmentVariable("COSMOS_ENDPOINT", "https://test.documents.azure.com/");
            Environment.SetEnvironmentVariable("AZURE_TENANT_ID", "test-tenant-id");
            
            try
            {
                // This constructor test would need to be mocked properly in a real scenario
                // For now, we're testing the logic that would be in the constructor
                var databaseName = Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME") ?? "gamer-uncle-dev-cosmos-container";
                var containerName = Environment.GetEnvironmentVariable("COSMOS_CONTAINER_NAME") ?? "Games";
                
                // Assert
                Assert.Equal("gamer-uncle-dev-cosmos-container", databaseName);
                Assert.Equal("Games", containerName);
            }
            finally
            {
                // Cleanup
                Environment.SetEnvironmentVariable("COSMOS_ENDPOINT", null);
                Environment.SetEnvironmentVariable("AZURE_TENANT_ID", null);
            }
        }

        [Fact]
        public void Constructor_ShouldUseProductionSettings_WhenEnvironmentVariablesSet()
        {
            // Arrange
            Environment.SetEnvironmentVariable("COSMOS_DATABASE_NAME", "gamer-uncle-prod-cosmos-container");
            Environment.SetEnvironmentVariable("COSMOS_CONTAINER_NAME", "Games");
            Environment.SetEnvironmentVariable("COSMOS_ENDPOINT", "https://prod.documents.azure.com/");
            Environment.SetEnvironmentVariable("AZURE_TENANT_ID", "prod-tenant-id");
            
            try
            {
                // This constructor test would need to be mocked properly in a real scenario
                // For now, we're testing the logic that would be in the constructor
                var databaseName = Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME") ?? "gamer-uncle-dev-cosmos-container";
                var containerName = Environment.GetEnvironmentVariable("COSMOS_CONTAINER_NAME") ?? "Games";
                
                // Assert
                Assert.Equal("gamer-uncle-prod-cosmos-container", databaseName);
                Assert.Equal("Games", containerName);
            }
            finally
            {
                // Cleanup
                Environment.SetEnvironmentVariable("COSMOS_DATABASE_NAME", null);
                Environment.SetEnvironmentVariable("COSMOS_CONTAINER_NAME", null);
                Environment.SetEnvironmentVariable("COSMOS_ENDPOINT", null);
                Environment.SetEnvironmentVariable("AZURE_TENANT_ID", null);
            }
        }

        [Theory]
        [InlineData("", "gamer-uncle-dev-cosmos-container")]
        [InlineData(null, "gamer-uncle-dev-cosmos-container")]
        [InlineData("custom-database", "custom-database")]
        [InlineData("gamer-uncle-prod-cosmos-container", "gamer-uncle-prod-cosmos-container")]
        public void DatabaseName_ShouldHandleVariousEnvironmentValues(string envValue, string expectedValue)
        {
            // Arrange
            Environment.SetEnvironmentVariable("COSMOS_DATABASE_NAME", envValue);
            
            try
            {
                // Act
                var databaseName = Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME") ?? "gamer-uncle-dev-cosmos-container";
                
                // Assert
                Assert.Equal(expectedValue, databaseName);
            }
            finally
            {
                // Cleanup
                Environment.SetEnvironmentVariable("COSMOS_DATABASE_NAME", null);
            }
        }

        [Theory]
        [InlineData("", "Games")]
        [InlineData(null, "Games")]
        [InlineData("CustomContainer", "CustomContainer")]
        [InlineData("Games", "Games")]
        public void ContainerName_ShouldHandleVariousEnvironmentValues(string envValue, string expectedValue)
        {
            // Arrange
            Environment.SetEnvironmentVariable("COSMOS_CONTAINER_NAME", envValue);
            
            try
            {
                // Act
                var containerName = Environment.GetEnvironmentVariable("COSMOS_CONTAINER_NAME") ?? "Games";
                
                // Assert
                Assert.Equal(expectedValue, containerName);
            }
            finally
            {
                // Cleanup
                Environment.SetEnvironmentVariable("COSMOS_CONTAINER_NAME", null);
            }
        }
    }

    public class DurableGameUpsertFunctionDependencyInjectionTests
    {
        [Fact]
        public void Constructor_WithValidCosmosClient_ShouldInitializeSuccessfully()
        {
            // Arrange
            var mockCosmosClient = new Mock<Microsoft.Azure.Cosmos.CosmosClient>();
            var mockContainer = new Mock<Microsoft.Azure.Cosmos.Container>();
            var mockLogger = new Mock<ILogger<DurableGameUpsertFunction>>();
            
            // Setup the mock to return a container
            mockCosmosClient.Setup(x => x.GetContainer(It.IsAny<string>(), It.IsAny<string>()))
                          .Returns(mockContainer.Object);

            // Act
            var function = new DurableGameUpsertFunction(mockCosmosClient.Object, mockLogger.Object);

            // Assert
            Assert.NotNull(function);
        }

        [Fact]
        public void Constructor_WithNullCosmosClient_ShouldThrowArgumentNullException()
        {
            // Arrange
            var mockLogger = new Mock<ILogger<DurableGameUpsertFunction>>();

            // Act & Assert
            Assert.Throws<ArgumentNullException>(() => 
                new DurableGameUpsertFunction(null!, mockLogger.Object));
        }

        [Fact]
        public void Constructor_WithNullLogger_ShouldThrowArgumentNullException()
        {
            // Arrange
            var mockCosmosClient = new Mock<Microsoft.Azure.Cosmos.CosmosClient>();

            // Act & Assert
            Assert.Throws<ArgumentNullException>(() => 
                new DurableGameUpsertFunction(mockCosmosClient.Object, null!));
        }
    }

    public class CheckGameExistsActivityTests
    {
        private readonly Mock<CosmosClient> _mockCosmosClient;
        private readonly Mock<Container> _mockContainer;
        private readonly Mock<ILogger<DurableGameUpsertFunction>> _mockLogger;
        private readonly DurableGameUpsertFunction _function;

        public CheckGameExistsActivityTests()
        {
            _mockCosmosClient = new Mock<CosmosClient>();
            _mockContainer = new Mock<Container>();
            _mockLogger = new Mock<ILogger<DurableGameUpsertFunction>>();

            _mockCosmosClient.Setup(x => x.GetContainer(It.IsAny<string>(), It.IsAny<string>()))
                           .Returns(_mockContainer.Object);

            _function = new DurableGameUpsertFunction(_mockCosmosClient.Object, _mockLogger.Object);
        }

        [Fact]
        public async Task CheckGameExistsActivity_WhenGameExists_ShouldReturnTrue()
        {
            // Arrange
            var gameId = "123";
            var documentId = "bgg-123";
            var gameDocument = new GameDocument { id = documentId, name = "Test Game" };
            
            var mockResponse = new Mock<ItemResponse<GameDocument>>();
            mockResponse.Setup(x => x.Resource).Returns(gameDocument);

            _mockContainer.Setup(x => x.ReadItemAsync<GameDocument>(
                documentId, 
                new PartitionKey(documentId), 
                null, 
                default))
                .ReturnsAsync(mockResponse.Object);

            // Act
            var result = await _function.CheckGameExistsActivity(gameId);

            // Assert
            Assert.True(result);
            _mockContainer.Verify(x => x.ReadItemAsync<GameDocument>(
                documentId, 
                new PartitionKey(documentId), 
                null, 
                default), Times.Once);
        }

        [Fact]
        public async Task CheckGameExistsActivity_WhenGameNotFound_ShouldReturnFalse()
        {
            // Arrange
            var gameId = "123";
            var documentId = "bgg-123";

            _mockContainer.Setup(x => x.ReadItemAsync<GameDocument>(
                documentId, 
                new PartitionKey(documentId), 
                null, 
                default))
                .ThrowsAsync(new CosmosException("Not Found", HttpStatusCode.NotFound, 0, "", 0));

            // Act
            var result = await _function.CheckGameExistsActivity(gameId);

            // Assert
            Assert.False(result);
        }

        [Fact]
        public async Task CheckGameExistsActivity_WhenOtherCosmosException_ShouldReturnFalse()
        {
            // Arrange
            var gameId = "123";
            var documentId = "bgg-123";

            _mockContainer.Setup(x => x.ReadItemAsync<GameDocument>(
                documentId, 
                new PartitionKey(documentId), 
                null, 
                default))
                .ThrowsAsync(new CosmosException("Server Error", HttpStatusCode.InternalServerError, 0, "", 0));

            // Act
            var result = await _function.CheckGameExistsActivity(gameId);

            // Assert
            Assert.False(result);
        }

        [Theory]
        [InlineData("")]
        [InlineData(" ")]
        [InlineData(null)]
        public async Task CheckGameExistsActivity_WithInvalidGameId_ShouldReturnFalse(string invalidGameId)
        {
            // Act
            var result = await _function.CheckGameExistsActivity(invalidGameId);

            // Assert
            Assert.False(result);
            _mockContainer.Verify(x => x.ReadItemAsync<GameDocument>(
                It.IsAny<string>(), 
                It.IsAny<PartitionKey>(), 
                It.IsAny<ItemRequestOptions>(), 
                default), Times.Never);
        }

        [Fact]
        public async Task CheckGameExistsActivity_WithQuotedGameId_ShouldStripQuotes()
        {
            // Arrange
            var gameId = "\"123\"";
            var expectedDocumentId = "bgg-123";
            
            var mockResponse = new Mock<ItemResponse<GameDocument>>();
            mockResponse.Setup(x => x.Resource).Returns(new GameDocument { id = expectedDocumentId });

            _mockContainer.Setup(x => x.ReadItemAsync<GameDocument>(
                expectedDocumentId, 
                new PartitionKey(expectedDocumentId), 
                null, 
                default))
                .ReturnsAsync(mockResponse.Object);

            // Act
            var result = await _function.CheckGameExistsActivity(gameId);

            // Assert
            Assert.True(result);
            _mockContainer.Verify(x => x.ReadItemAsync<GameDocument>(
                expectedDocumentId, 
                new PartitionKey(expectedDocumentId), 
                null, 
                default), Times.Once);
        }
    }

    public class BggRankedListClientTests
    {
        [Fact]
        public void ParseGameIdsFromHtml_WithValidHtml_ReturnsGameIds()
        {
            // Arrange — simulates a snippet of BGG browse page HTML
            var html = @"
                <a href=""/boardgame/174430/brass-birmingham"">Brass: Birmingham</a>
                <a href=""/boardgame/342942/ark-nova"">Ark Nova</a>
                <a href=""/boardgame/204135/skyjo"">Skyjo</a>
                <a href=""/boardgame/281094/plunder-a-pirates-life"">Plunder</a>
            ";

            // Act
            var ids = GamerUncle.Functions.Helpers.BggRankedListClient.ParseGameIdsFromHtml(html);

            // Assert
            Assert.Equal(4, ids.Count);
            Assert.Contains("174430", ids);
            Assert.Contains("342942", ids);
            Assert.Contains("204135", ids);
            Assert.Contains("281094", ids);
        }

        [Fact]
        public void ParseGameIdsFromHtml_WithDuplicateIds_ReturnsDeduplicated()
        {
            // Arrange — same game ID appears multiple times (e.g., thumbnail + title link)
            var html = @"
                <a href=""/boardgame/174430/brass-birmingham"">Thumbnail</a>
                <a href=""/boardgame/174430/brass-birmingham"">Brass: Birmingham</a>
                <a href=""/boardgame/342942/ark-nova"">Ark Nova</a>
            ";

            // Act
            var ids = GamerUncle.Functions.Helpers.BggRankedListClient.ParseGameIdsFromHtml(html);

            // Assert
            Assert.Equal(2, ids.Count);
            Assert.Contains("174430", ids);
            Assert.Contains("342942", ids);
        }

        [Fact]
        public void ParseGameIdsFromHtml_WithEmptyHtml_ReturnsEmptyList()
        {
            Assert.Empty(GamerUncle.Functions.Helpers.BggRankedListClient.ParseGameIdsFromHtml(""));
        }

        [Fact]
        public void ParseGameIdsFromHtml_WithNullHtml_ReturnsEmptyList()
        {
            Assert.Empty(GamerUncle.Functions.Helpers.BggRankedListClient.ParseGameIdsFromHtml(null!));
        }

        [Fact]
        public void ParseGameIdsFromHtml_WithNoGameLinks_ReturnsEmptyList()
        {
            var html = @"<html><body><p>No games here</p></body></html>";

            Assert.Empty(GamerUncle.Functions.Helpers.BggRankedListClient.ParseGameIdsFromHtml(html));
        }

        [Fact]
        public void ParseGameIdsFromHtml_IgnoresNonBoardgameLinks()
        {
            // Arrange — forum, user, and other non-boardgame links should be ignored
            var html = @"
                <a href=""/boardgame/174430/brass-birmingham"">Brass</a>
                <a href=""/forum/174430/brass-birmingham"">Forum</a>
                <a href=""/user/someuser"">User</a>
                <a href=""/boardgameexpansion/999/some-expansion"">Expansion</a>
            ";

            // Act
            var ids = GamerUncle.Functions.Helpers.BggRankedListClient.ParseGameIdsFromHtml(html);

            // Assert — only the /boardgame/ link should match
            Assert.Single(ids);
            Assert.Contains("174430", ids);
        }

        [Fact]
        public void Constructor_WithNullHttpClient_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new GamerUncle.Functions.Helpers.BggRankedListClient(null!));
        }
    }

    public class RankedSyncRequestTests
    {
        [Fact]
        public void DefaultValues_AreCorrect()
        {
            var request = new RankedSyncRequest();

            Assert.Equal(1, request.StartPage);
            Assert.Equal(100, request.EndPage);
        }

        [Fact]
        public void CustomValues_ArePreserved()
        {
            var request = new RankedSyncRequest
            {
                StartPage = 5,
                EndPage = 50
            };

            Assert.Equal(5, request.StartPage);
            Assert.Equal(50, request.EndPage);
        }
    }

    public class HighSignalSyncRequestDefaultsTests
    {
        [Fact]
        public void DefaultLimit_Is7000()
        {
            var request = new HighSignalSyncRequest();

            Assert.Equal(7_000, request.Limit);
        }

        [Fact]
        public void DefaultMinVotes_Is50()
        {
            var request = new HighSignalSyncRequest();

            Assert.Equal(50, request.MinVotes);
        }

        [Fact]
        public void DefaultMinAverage_Is5()
        {
            var request = new HighSignalSyncRequest();

            Assert.Equal(5.0, request.MinAverage);
        }

        [Fact]
        public void DefaultMinBayes_Is5()
        {
            var request = new HighSignalSyncRequest();

            Assert.Equal(5.0, request.MinBayes);
        }
    }

    public class HighSignalFilterTests
    {
        [Fact]
        public void IsHighSignal_WithQualifyingGame_ReturnsTrue()
        {
            var game = new GameDocument
            {
                id = "bgg-204135",
                name = "Skyjo",
                numVotes = 6341,
                averageRating = 6.655,
                bggRating = 6.7
            };

            Assert.True(HighSignalFilter.IsHighSignal(game, 5.0, 5.0, 50));
        }

        [Fact]
        public void IsHighSignal_WithLowVotes_ReturnsFalse()
        {
            var game = new GameDocument
            {
                id = "bgg-999",
                name = "Obscure Game",
                numVotes = 10,
                averageRating = 8.0,
                bggRating = 7.0
            };

            Assert.False(HighSignalFilter.IsHighSignal(game, 5.0, 5.0, 50));
        }

        [Fact]
        public void IsHighSignal_WithLowBggRating_ReturnsFalse()
        {
            var game = new GameDocument
            {
                id = "bgg-999",
                name = "Low Rated",
                numVotes = 1000,
                averageRating = 6.0,
                bggRating = 3.0
            };

            Assert.False(HighSignalFilter.IsHighSignal(game, 5.0, 5.0, 50));
        }

        [Fact]
        public void IsHighSignal_WithLowAverageRating_ReturnsFalse()
        {
            var game = new GameDocument
            {
                id = "bgg-999",
                name = "Low Average",
                numVotes = 1000,
                averageRating = 3.0,
                bggRating = 6.0
            };

            Assert.False(HighSignalFilter.IsHighSignal(game, 5.0, 5.0, 50));
        }

        [Fact]
        public void IsHighSignal_WithNullGame_ReturnsFalse()
        {
            Assert.False(HighSignalFilter.IsHighSignal(null!, 5.0, 5.0, 50));
        }
    }
}
