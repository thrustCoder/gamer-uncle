using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Api.Services.Authentication;
using System.Net;

namespace GamerUncle.Api.Tests.Authentication
{
    public class AppKeyAuthorizationFilterTests
    {
        private const string ValidAppKey = "test-app-key-12345";
        private const string AppKeyHeaderName = "X-GamerUncle-AppKey";

        private static AppKeyAuthorizationFilter CreateFilter(
            string? configuredAppKey = ValidAppKey,
            bool isTestEnvironment = false)
        {
            var configurationMock = new Mock<IConfiguration>();
            configurationMock.Setup(c => c["GameSearch:AppKey"]).Returns(configuredAppKey);
            configurationMock.Setup(c => c.GetSection("Testing:DisableRateLimit").Value)
                .Returns(isTestEnvironment ? "true" : "false");

            var loggerMock = new Mock<ILogger<AppKeyAuthorizationFilter>>();

            var environmentMock = new Mock<IWebHostEnvironment>();
            environmentMock.Setup(e => e.EnvironmentName)
                .Returns(isTestEnvironment ? "Testing" : "Development");

            return new AppKeyAuthorizationFilter(
                configurationMock.Object,
                loggerMock.Object,
                environmentMock.Object);
        }

        private static ActionExecutingContext CreateActionContext(
            string? appKeyHeader = null,
            string clientIp = "127.0.0.1")
        {
            var httpContext = new DefaultHttpContext();
            httpContext.Connection.RemoteIpAddress = IPAddress.Parse(clientIp);
            httpContext.Request.Headers.UserAgent = "TestUserAgent";

            if (appKeyHeader != null)
            {
                httpContext.Request.Headers[AppKeyHeaderName] = appKeyHeader;
            }

            var actionContext = new ActionContext(
                httpContext,
                new RouteData(),
                new ActionDescriptor());

            return new ActionExecutingContext(
                actionContext,
                new List<IFilterMetadata>(),
                new Dictionary<string, object?>(),
                new Mock<Controller>().Object);
        }

        [Fact]
        public async Task OnActionExecutionAsync_ValidAppKey_AllowsRequest()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext(ValidAppKey);
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.True(nextCalled);
            Assert.Null(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_MissingAppKey_ReturnsUnauthorized()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext(appKeyHeader: null);
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.False(nextCalled);
            Assert.IsType<UnauthorizedObjectResult>(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_InvalidAppKey_ReturnsUnauthorized()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext("wrong-app-key");
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.False(nextCalled);
            Assert.IsType<UnauthorizedObjectResult>(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_TestEnvironment_SkipsValidation()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey, isTestEnvironment: true);
            var context = CreateActionContext(appKeyHeader: null); // No key provided
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.True(nextCalled); // Request should proceed without validation
            Assert.Null(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_NoConfiguredAppKey_SkipsValidation()
        {
            // Arrange
            var filter = CreateFilter(configuredAppKey: null);
            var context = CreateActionContext(appKeyHeader: null);
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.True(nextCalled); // Should allow when no key is configured
            Assert.Null(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_EmptyConfiguredAppKey_SkipsValidation()
        {
            // Arrange
            var filter = CreateFilter(configuredAppKey: "");
            var context = CreateActionContext(appKeyHeader: null);
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.True(nextCalled);
            Assert.Null(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_CaseSensitiveKeyComparison_RejectsWrongCase()
        {
            // Arrange
            var filter = CreateFilter("Test-App-Key");
            var context = CreateActionContext("test-app-key"); // Different case
            var nextCalled = false;

            Task<ActionExecutedContext> Next()
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(
                    context,
                    new List<IFilterMetadata>(),
                    new Mock<Controller>().Object));
            }

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            Assert.False(nextCalled);
            Assert.IsType<UnauthorizedObjectResult>(context.Result);
        }
    }
}
