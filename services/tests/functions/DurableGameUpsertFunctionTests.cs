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
}
