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
    public class RecommendationsControllerTests
    {
        private readonly Mock<IAgentServiceClient> _mockAgentService;
        private readonly Mock<ILogger<RecommendationsController>> _mockLogger;
        private readonly RecommendationsController _controller;

        public RecommendationsControllerTests()
        {
            _mockAgentService = new Mock<IAgentServiceClient>();
            _mockLogger = new Mock<ILogger<RecommendationsController>>();
            _controller = new RecommendationsController(_mockAgentService.Object, _mockLogger.Object);
            
            // Setup HttpContext for IP and UserAgent tracking
            var httpContext = new DefaultHttpContext();
            httpContext.Connection.RemoteIpAddress = IPAddress.Parse("127.0.0.1");
            httpContext.Request.Headers.UserAgent = "TestUserAgent";
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = httpContext
            };
        }

        [Fact]
        public async Task RecommendGame_ValidRequest_ReturnsOkResult()
        {
            // Arrange
            var query = new UserQuery 
            { 
                Query = "I want a strategy game", 
                ConversationId = "test-conversation-123" 
            };
            var expectedResponse = new AgentResponse { ResponseText = "Test recommendation" };
            
            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(query.Query, query.ConversationId))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.RecommendGame(query);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.Equal(expectedResponse, okResult.Value);
            
            // Verify logging
            VerifyLogCalled(LogLevel.Information, "Game recommendation request from IP");
            VerifyLogCalled(LogLevel.Information, "Game recommendation completed successfully");
        }

        [Fact]
        public async Task RecommendGame_ServiceThrowsException_ReturnsInternalServerError()
        {
            // Arrange
            var query = new UserQuery 
            { 
                Query = "I want a strategy game", 
                ConversationId = "test-conversation-123" 
            };
            
            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(query.Query, query.ConversationId))
                .ThrowsAsync(new Exception("Service unavailable"));

            // Act
            var result = await _controller.RecommendGame(query);

            // Assert
            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(500, statusResult.StatusCode);
            Assert.Equal("An error occurred while processing your request", statusResult.Value);
            
            // Verify error logging
            VerifyLogCalled(LogLevel.Error, "Error processing game recommendation");
        }

        [Fact]
        public async Task RecommendGame_LogsClientInformation()
        {
            // Arrange
            var query = new UserQuery 
            { 
                Query = "I want a strategy game", 
                ConversationId = "test-conversation-123" 
            };
            var expectedResponse = new AgentResponse { ResponseText = "Test recommendation" };
            
            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(query.Query, query.ConversationId))
                .ReturnsAsync(expectedResponse);

            // Act
            await _controller.RecommendGame(query);

            // Assert - Verify that client IP and UserAgent are logged
            _mockLogger.Verify(
                x => x.Log(
                    LogLevel.Information,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("127.0.0.1") && v.ToString()!.Contains("TestUserAgent")),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public async Task RecommendGame_WithNullOrEmptyQuery_StillProcesses(string? queryText)
        {
            // Arrange
            var query = new UserQuery 
            { 
                Query = queryText!, 
                ConversationId = "test-conversation-123" 
            };
            var expectedResponse = new AgentResponse { ResponseText = "Default recommendation" };
            
            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(queryText!, query.ConversationId))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.RecommendGame(query);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.Equal(expectedResponse, okResult.Value);
        }

        private void VerifyLogCalled(LogLevel logLevel, string messageContains)
        {
            _mockLogger.Verify(
                x => x.Log(
                    logLevel,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains(messageContains)),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.AtLeastOnce);
        }
    }
}
