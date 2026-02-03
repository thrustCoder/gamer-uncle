using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Api.Controllers;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;
using System.Net;

namespace GamerUncle.Api.Tests
{
    public class GamesControllerTests
    {
        private readonly Mock<IGameSearchService> _mockGameSearchService;
        private readonly Mock<ILogger<GamesController>> _mockLogger;
        private readonly GamesController _controller;

        public GamesControllerTests()
        {
            _mockGameSearchService = new Mock<IGameSearchService>();
            _mockLogger = new Mock<ILogger<GamesController>>();
            _controller = new GamesController(_mockGameSearchService.Object, _mockLogger.Object);

            // Setup HttpContext for IP and UserAgent tracking
            var httpContext = new DefaultHttpContext();
            httpContext.Connection.RemoteIpAddress = IPAddress.Parse("127.0.0.1");
            httpContext.Request.Headers.UserAgent = "TestUserAgent";
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = httpContext
            };
        }

        #region SearchGames Tests

        [Fact]
        public async Task SearchGames_ValidQuery_ReturnsOkResult()
        {
            // Arrange
            var query = "catan";
            var expectedResponse = new GameSearchResponse
            {
                Results = new List<GameSearchResult>
                {
                    new() { Id = "bgg-13", Name = "Catan", AverageRating = 7.1, MinPlayers = 3, MaxPlayers = 4 }
                },
                TotalCount = 1
            };

            _mockGameSearchService
                .Setup(x => x.SearchGamesAsync(query, 5))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.SearchGames(query);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<GameSearchResponse>(okResult.Value);
            Assert.Single(response.Results);
            Assert.Equal("Catan", response.Results[0].Name);
        }

        [Fact]
        public async Task SearchGames_EmptyQuery_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.SearchGames("");

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            Assert.NotNull(badRequestResult.Value);
        }

        [Fact]
        public async Task SearchGames_NullQuery_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.SearchGames(null!);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            Assert.NotNull(badRequestResult.Value);
        }

        [Theory]
        [InlineData("a")]
        [InlineData("ab")]
        public async Task SearchGames_QueryTooShort_ReturnsBadRequest(string query)
        {
            // Act
            var result = await _controller.SearchGames(query);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            Assert.NotNull(badRequestResult.Value);
        }

        [Fact]
        public async Task SearchGames_ServiceThrowsException_ReturnsInternalServerError()
        {
            // Arrange
            var query = "catan";
            _mockGameSearchService
                .Setup(x => x.SearchGamesAsync(query, 5))
                .ThrowsAsync(new Exception("Database unavailable"));

            // Act
            var result = await _controller.SearchGames(query);

            // Assert
            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(500, statusResult.StatusCode);
        }

        [Fact]
        public async Task SearchGames_NoResults_ReturnsEmptyList()
        {
            // Arrange
            var query = "xyznonexistent";
            var expectedResponse = new GameSearchResponse
            {
                Results = new List<GameSearchResult>(),
                TotalCount = 0
            };

            _mockGameSearchService
                .Setup(x => x.SearchGamesAsync(query, 5))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.SearchGames(query);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<GameSearchResponse>(okResult.Value);
            Assert.Empty(response.Results);
            Assert.Equal(0, response.TotalCount);
        }

        #endregion

        #region GetGameDetails Tests

        [Fact]
        public async Task GetGameDetails_ValidId_ReturnsOkResult()
        {
            // Arrange
            var gameId = "bgg-13";
            var expectedResponse = new GameDetailsResponse
            {
                Id = gameId,
                Name = "Catan",
                Overview = "Trade, build, settle the island of Catan",
                AverageRating = 7.1,
                BggRating = 7.0,
                NumVotes = 98234,
                MinPlayers = 3,
                MaxPlayers = 4,
                AgeRequirement = 10,
                RulesUrl = "https://www.catan.com/rules"
            };

            _mockGameSearchService
                .Setup(x => x.GetGameDetailsAsync(gameId))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.GetGameDetails(gameId);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<GameDetailsResponse>(okResult.Value);
            Assert.Equal("Catan", response.Name);
            Assert.Equal(7.1, response.AverageRating);
        }

        [Fact]
        public async Task GetGameDetails_EmptyId_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.GetGameDetails("");

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            Assert.NotNull(badRequestResult.Value);
        }

        [Fact]
        public async Task GetGameDetails_NullId_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.GetGameDetails(null!);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            Assert.NotNull(badRequestResult.Value);
        }

        [Fact]
        public async Task GetGameDetails_GameNotFound_ReturnsNotFound()
        {
            // Arrange
            var gameId = "bgg-nonexistent";
            _mockGameSearchService
                .Setup(x => x.GetGameDetailsAsync(gameId))
                .ReturnsAsync((GameDetailsResponse?)null);

            // Act
            var result = await _controller.GetGameDetails(gameId);

            // Assert
            var notFoundResult = Assert.IsType<NotFoundObjectResult>(result);
            Assert.NotNull(notFoundResult.Value);
        }

        [Fact]
        public async Task GetGameDetails_ServiceThrowsException_ReturnsInternalServerError()
        {
            // Arrange
            var gameId = "bgg-13";
            _mockGameSearchService
                .Setup(x => x.GetGameDetailsAsync(gameId))
                .ThrowsAsync(new Exception("Database unavailable"));

            // Act
            var result = await _controller.GetGameDetails(gameId);

            // Assert
            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(500, statusResult.StatusCode);
        }

        #endregion
    }
}
