using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Moq;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Xunit;
using GamerUncle.Api.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Tests
{
    public class RateLimitingIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly Mock<IAgentServiceClient> _mockAgentService;

        public RateLimitingIntegrationTests(WebApplicationFactory<Program> factory)
        {
            _mockAgentService = new Mock<IAgentServiceClient>();

            _factory = factory.WithWebHostBuilder(builder =>
            {
                // Set to RateLimitTesting environment to enable strict rate limiting for tests
                builder.UseEnvironment("RateLimitTesting");

                builder.ConfigureAppConfiguration((context, config) =>
                {
                    // Ensure rate limiting is enabled with test-friendly limits
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Testing:DisableRateLimit"] = "false",
                        ["RateLimiting:PermitLimit"] = "2",       // Allow 2 requests for more predictable testing
                        ["RateLimiting:WindowSeconds"] = "2",     // Use seconds instead of minutes for faster tests
                        ["RateLimiting:QueueLimit"] = "0"        // No queue for simpler testing
                    });
                });

                builder.ConfigureServices(services =>
                {
                    // Remove the real agent service and replace with mock
                    var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IAgentServiceClient));
                    if (descriptor != null)
                        services.Remove(descriptor);

                    services.AddTransient(_ => _mockAgentService.Object);

                    // Override rate limiting configuration for testing
                    services.Configure<Microsoft.AspNetCore.RateLimiting.RateLimiterOptions>(options =>
                    {
                        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                        {
                            return RateLimitPartition.GetFixedWindowLimiter("test-partition",
                                _ => new FixedWindowRateLimiterOptions
                                {
                                    PermitLimit = 2,
                                    Window = TimeSpan.FromSeconds(1), // Very short window for testing
                                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                                    QueueLimit = 0
                                });
                        });
                    });
                });
            });
        }

        [Fact]
        public async Task RecommendGame_WithinRateLimit_ReturnsSuccess()
        {
            // Arrange
            var client = _factory.CreateClient();
            var query = new UserQuery
            {
                Query = "I want a strategy game",
                ConversationId = "test-conversation-1"
            };
            var expectedResponse = new AgentResponse { ResponseText = "Test recommendation" };

            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(query.Query, query.ConversationId))
                .ReturnsAsync(expectedResponse);

            var json = JsonSerializer.Serialize(query);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await client.PostAsync("/api/recommendations", content);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task RecommendGame_ExceedsRateLimit_ReturnsTooManyRequests()
        {
            // Arrange
            var client = _factory.CreateClient();
            var query = new UserQuery
            {
                Query = "I want a strategy game",
                ConversationId = "test-conversation-2"
            };
            var expectedResponse = new AgentResponse { ResponseText = "Test recommendation" };

            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(query.Query, query.ConversationId))
                .ReturnsAsync(expectedResponse);

            var json = JsonSerializer.Serialize(query);

            // Act - Make requests sequentially to ensure we hit the rate limit
            var responses = new List<HttpResponseMessage>();

            // Send requests one by one to trigger rate limiting more reliably
            for (int i = 0; i < 5; i++)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("/api/recommendations", content);
                responses.Add(response);

                // Small delay to ensure requests are processed
                await Task.Delay(50);
            }

            // Debug: Log all response status codes
            var statusCodes = responses.Select(r => r.StatusCode).ToList();
            var debugMessage = $"Response status codes: [{string.Join(", ", statusCodes)}]";

            // Assert
            var successCount = responses.Count(r => r.StatusCode == HttpStatusCode.OK);
            var rateLimitedCount = responses.Count(r => r.StatusCode == HttpStatusCode.TooManyRequests);

            // Should have max 2 successful requests (permit limit) and at least 1 rate-limited
            Assert.True(successCount <= 2, $"Expected at most 2 successful requests, got {successCount}. {debugMessage}");
            Assert.True(rateLimitedCount >= 1, $"Expected at least 1 rate-limited request, got {rateLimitedCount}. {debugMessage}");

            // Cleanup responses
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }

        [Fact]
        public async Task RecommendGame_RateLimitResponse_ContainsCorrectMessage()
        {
            // Arrange
            var client = _factory.CreateClient();
            var query = new UserQuery
            {
                Query = "I want a strategy game",
                ConversationId = "test-conversation-3"
            };
            var expectedResponse = new AgentResponse { ResponseText = "Test recommendation" };

            _mockAgentService
                .Setup(x => x.GetRecommendationsAsync(query.Query, query.ConversationId))
                .ReturnsAsync(expectedResponse);

            var json = JsonSerializer.Serialize(query);

            // Act - Make enough requests to trigger rate limiting (8 requests, limit is 2+0=2)
            HttpResponseMessage? rateLimitedResponse = null;
            for (int i = 0; i < 8; i++)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("/api/recommendations", content);

                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    rateLimitedResponse = response;
                    break;
                }

                // Small delay to ensure requests are processed sequentially
                await Task.Delay(10);
            }

            // Assert
            Assert.NotNull(rateLimitedResponse);
            Assert.Equal(HttpStatusCode.TooManyRequests, rateLimitedResponse.StatusCode);

            var responseContent = await rateLimitedResponse.Content.ReadAsStringAsync();
            Assert.Contains("Rate limit exceeded", responseContent);

            // Cleanup
            rateLimitedResponse.Dispose();
        }
    }
}
