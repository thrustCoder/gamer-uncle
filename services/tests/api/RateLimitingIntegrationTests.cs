using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;

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
                builder.ConfigureServices(services =>
                {
                    // Remove the real agent service and replace with mock
                    var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IAgentServiceClient));
                    if (descriptor != null)
                        services.Remove(descriptor);
                    
                    services.AddTransient(_ => _mockAgentService.Object);
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

            // Act - Make 11 requests (rate limit is 10 per minute)
            var tasks = new List<Task<HttpResponseMessage>>();
            for (int i = 0; i < 11; i++)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                tasks.Add(client.PostAsync("/api/recommendations", content));
            }

            var responses = await Task.WhenAll(tasks);

            // Assert
            var successCount = responses.Count(r => r.StatusCode == HttpStatusCode.OK);
            var rateLimitedCount = responses.Count(r => r.StatusCode == HttpStatusCode.TooManyRequests);
            
            // Should have some successful requests and some rate-limited ones
            Assert.True(successCount >= 10, $"Expected at least 10 successful requests, got {successCount}");
            Assert.True(rateLimitedCount >= 1, $"Expected at least 1 rate-limited request, got {rateLimitedCount}");
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

            // Act - Make enough requests to trigger rate limiting
            HttpResponseMessage? rateLimitedResponse = null;
            for (int i = 0; i < 15; i++)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("/api/recommendations", content);
                
                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    rateLimitedResponse = response;
                    break;
                }
            }

            // Assert
            Assert.NotNull(rateLimitedResponse);
            Assert.Equal(HttpStatusCode.TooManyRequests, rateLimitedResponse.StatusCode);
            
            var responseContent = await rateLimitedResponse.Content.ReadAsStringAsync();
            Assert.Contains("Rate limit exceeded", responseContent);
        }
    }
}
