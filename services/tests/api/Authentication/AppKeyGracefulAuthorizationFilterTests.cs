using Microsoft.ApplicationInsights;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Api.Services.Authentication;
using System.Net;

namespace GamerUncle.Api.Tests.Authentication
{
    public class AppKeyGracefulAuthorizationFilterTests
    {
        private const string ValidAppKey = "test-app-key-12345";
        private const string AppKeyHeaderName = "X-GamerUncle-AppKey";
        private const string DeprecatedResponseHeader = "X-AppKey-Deprecated";

        private readonly MockTelemetryChannel _channel = new();

        private AppKeyGracefulAuthorizationFilter CreateFilter(
            string? configuredAppKey = ValidAppKey,
            bool isTestEnvironment = false)
        {
            var configurationMock = new Mock<IConfiguration>();
            configurationMock.Setup(c => c["ApiAuthentication:AppKey"]).Returns(configuredAppKey);
            configurationMock.Setup(c => c.GetSection("Testing:DisableRateLimit").Value)
                .Returns(isTestEnvironment ? "true" : "false");

            var loggerMock = new Mock<ILogger<AppKeyGracefulAuthorizationFilter>>();

            var environmentMock = new Mock<IWebHostEnvironment>();
            environmentMock.Setup(e => e.EnvironmentName)
                .Returns(isTestEnvironment ? "Testing" : "Development");

            var telemetryConfig = new TelemetryConfiguration
            {
                TelemetryChannel = _channel,
                ConnectionString = "InstrumentationKey=test-key-00000000-0000-0000-0000-000000000000"
            };
            var telemetryClient = new TelemetryClient(telemetryConfig);

            return new AppKeyGracefulAuthorizationFilter(
                configurationMock.Object,
                loggerMock.Object,
                environmentMock.Object,
                telemetryClient);
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
            // Should NOT add deprecation header when valid key is provided
            Assert.False(context.HttpContext.Response.Headers.ContainsKey(DeprecatedResponseHeader));
        }

        [Fact]
        public async Task OnActionExecutionAsync_MissingAppKey_AllowsRequestWithWarningHeader()
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

            // Assert - request should proceed (grace mode)
            Assert.True(nextCalled);
            Assert.Null(context.Result);
            // Should add deprecation header
            Assert.True(context.HttpContext.Response.Headers.ContainsKey(DeprecatedResponseHeader));
            Assert.Equal("true", context.HttpContext.Response.Headers[DeprecatedResponseHeader].ToString());
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

            // Assert - invalid key should be rejected immediately
            Assert.False(nextCalled);
            Assert.IsType<UnauthorizedObjectResult>(context.Result);
        }

        [Fact]
        public async Task OnActionExecutionAsync_TestEnvironment_SkipsValidation()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey, isTestEnvironment: true);
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
            Assert.True(nextCalled);
            Assert.Null(context.Result);
            // Should NOT add deprecation header when validation is skipped entirely
            Assert.False(context.HttpContext.Response.Headers.ContainsKey(DeprecatedResponseHeader));
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

        [Fact]
        public async Task OnActionExecutionAsync_ValidKey_DoesNotAddDeprecationHeader()
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
            Assert.False(context.HttpContext.Response.Headers.ContainsKey(DeprecatedResponseHeader));
        }

        [Fact]
        public async Task OnActionExecutionAsync_MissingKey_AddsDeprecationHeaderValue()
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
            Assert.True(nextCalled);
            Assert.True(context.HttpContext.Response.Headers.ContainsKey(DeprecatedResponseHeader));
            Assert.Equal("true", context.HttpContext.Response.Headers[DeprecatedResponseHeader].ToString());
        }

        [Fact]
        public async Task OnActionExecutionAsync_InvalidKey_DoesNotAddDeprecationHeader()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext("invalid-key");
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
            Assert.False(context.HttpContext.Response.Headers.ContainsKey(DeprecatedResponseHeader));
        }

        /// <summary>
        /// In-memory telemetry channel for capturing sent items in tests.
        /// </summary>
        private class MockTelemetryChannel : ITelemetryChannel
        {
            public List<ITelemetry> SentItems { get; } = new();
            public bool? DeveloperMode { get; set; }
            public string EndpointAddress { get; set; } = "";

            public void Dispose() { }
            public void Flush() { }
            public void Send(ITelemetry item) => SentItems.Add(item);
        }

        // ── Structured telemetry event tests ─────────────────────────────

        [Fact]
        public async Task OnActionExecutionAsync_ValidKey_TracksEventWithValidOutcome()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext(ValidAppKey);
            Task<ActionExecutedContext> Next() => Task.FromResult(
                new ActionExecutedContext(context, new List<IFilterMetadata>(), new Mock<Controller>().Object));

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            var eventItem = _channel.SentItems.OfType<Microsoft.ApplicationInsights.DataContracts.EventTelemetry>()
                .FirstOrDefault(e => e.Name == "AppKey.GraceModeRequest");
            Assert.NotNull(eventItem);
            Assert.Equal("Valid", eventItem!.Properties["Outcome"]);
        }

        [Fact]
        public async Task OnActionExecutionAsync_MissingKey_TracksEventWithMissingOutcome()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext(appKeyHeader: null);
            Task<ActionExecutedContext> Next() => Task.FromResult(
                new ActionExecutedContext(context, new List<IFilterMetadata>(), new Mock<Controller>().Object));

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            var eventItem = _channel.SentItems.OfType<Microsoft.ApplicationInsights.DataContracts.EventTelemetry>()
                .FirstOrDefault(e => e.Name == "AppKey.GraceModeRequest");
            Assert.NotNull(eventItem);
            Assert.Equal("Missing", eventItem!.Properties["Outcome"]);
        }

        [Fact]
        public async Task OnActionExecutionAsync_InvalidKey_TracksEventWithInvalidOutcome()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey);
            var context = CreateActionContext("wrong-key");
            Task<ActionExecutedContext> Next() => Task.FromResult(
                new ActionExecutedContext(context, new List<IFilterMetadata>(), new Mock<Controller>().Object));

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert
            var eventItem = _channel.SentItems.OfType<Microsoft.ApplicationInsights.DataContracts.EventTelemetry>()
                .FirstOrDefault(e => e.Name == "AppKey.GraceModeRequest");
            Assert.NotNull(eventItem);
            Assert.Equal("Invalid", eventItem!.Properties["Outcome"]);
            Assert.Contains("Path", eventItem.Properties.Keys);
        }

        [Fact]
        public async Task OnActionExecutionAsync_TestEnvironment_DoesNotTrackEvent()
        {
            // Arrange
            var filter = CreateFilter(ValidAppKey, isTestEnvironment: true);
            var context = CreateActionContext(appKeyHeader: null);
            Task<ActionExecutedContext> Next() => Task.FromResult(
                new ActionExecutedContext(context, new List<IFilterMetadata>(), new Mock<Controller>().Object));

            // Act
            await filter.OnActionExecutionAsync(context, Next);

            // Assert — no events in test env
            var eventItems = _channel.SentItems.OfType<Microsoft.ApplicationInsights.DataContracts.EventTelemetry>().ToList();
            Assert.Empty(eventItems);
        }
    }
}
