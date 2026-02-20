using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using GamerUncle.Api.Controllers;
using GamerUncle.Api.Models;

namespace GamerUncle.Api.Tests
{
    public class AppConfigControllerTests
    {
        private readonly Mock<ILogger<AppConfigController>> _mockLogger;

        public AppConfigControllerTests()
        {
            _mockLogger = new Mock<ILogger<AppConfigController>>();
        }

        private AppConfigController CreateController(AppVersionPolicy policy)
        {
            var options = Options.Create(policy);
            return new AppConfigController(options, _mockLogger.Object);
        }

        private static AppVersionPolicy CreateDefaultPolicy() => new()
        {
            MinVersion = "3.2.0",
            UpgradeUrl = "https://apps.apple.com/app/gamer-uncle/id6740043763",
            UpgradeUrlAndroid = "https://play.google.com/store/apps/details?id=com.gameruncle",
            Message = "Please update to continue.",
            ForceUpgrade = false
        };

        [Fact]
        public void GetAppConfig_ReturnsOkWithVersionPolicy()
        {
            // Arrange
            var policy = CreateDefaultPolicy();
            var controller = CreateController(policy);

            // Act
            var result = controller.GetAppConfig();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var returnedPolicy = Assert.IsType<AppVersionPolicy>(okResult.Value);
            Assert.Equal("3.2.0", returnedPolicy.MinVersion);
            Assert.False(returnedPolicy.ForceUpgrade);
        }

        [Fact]
        public void GetAppConfig_ForceUpgradeTrue_ReturnsForceUpgradeFlag()
        {
            // Arrange
            var policy = CreateDefaultPolicy();
            policy.ForceUpgrade = true;
            var controller = CreateController(policy);

            // Act
            var result = controller.GetAppConfig();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var returnedPolicy = Assert.IsType<AppVersionPolicy>(okResult.Value);
            Assert.True(returnedPolicy.ForceUpgrade);
        }

        [Fact]
        public void GetAppConfig_ReturnsUpgradeUrls()
        {
            // Arrange
            var policy = CreateDefaultPolicy();
            var controller = CreateController(policy);

            // Act
            var result = controller.GetAppConfig();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var returnedPolicy = Assert.IsType<AppVersionPolicy>(okResult.Value);
            Assert.Equal("https://apps.apple.com/app/gamer-uncle/id6740043763", returnedPolicy.UpgradeUrl);
            Assert.Equal("https://play.google.com/store/apps/details?id=com.gameruncle", returnedPolicy.UpgradeUrlAndroid);
        }

        [Fact]
        public void GetAppConfig_ReturnsMessage()
        {
            // Arrange
            var policy = CreateDefaultPolicy();
            var controller = CreateController(policy);

            // Act
            var result = controller.GetAppConfig();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var returnedPolicy = Assert.IsType<AppVersionPolicy>(okResult.Value);
            Assert.Equal("Please update to continue.", returnedPolicy.Message);
        }

        [Fact]
        public void GetAppConfig_NullOptionalFields_ReturnsNulls()
        {
            // Arrange
            var policy = new AppVersionPolicy
            {
                MinVersion = "1.0.0",
                UpgradeUrl = null,
                UpgradeUrlAndroid = null,
                Message = null,
                ForceUpgrade = false
            };
            var controller = CreateController(policy);

            // Act
            var result = controller.GetAppConfig();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var returnedPolicy = Assert.IsType<AppVersionPolicy>(okResult.Value);
            Assert.Null(returnedPolicy.UpgradeUrl);
            Assert.Null(returnedPolicy.UpgradeUrlAndroid);
            Assert.Null(returnedPolicy.Message);
        }

        [Fact]
        public void GetAppConfig_LogsRequestDetails()
        {
            // Arrange
            var policy = CreateDefaultPolicy();
            var controller = CreateController(policy);

            // Act
            controller.GetAppConfig();

            // Assert - verify logging occurred
            _mockLogger.Verify(
                x => x.Log(
                    LogLevel.Information,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("AppConfig requested")),
                    null,
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once);
        }
    }
}
