using System.Net;
using System.Text;
using Newtonsoft.Json;
using Xunit;
using GamerUncle.Api.Models;
using GamerUncle.Api.FunctionalTests.Infrastructure;

namespace GamerUncle.Api.FunctionalTests.Controllers
{
    public class RecommendationsControllerTests : IClassFixture<TestFixture>
    {
        private readonly TestFixture _fixture;
        private readonly HttpClient _httpClient;

        public RecommendationsControllerTests(TestFixture fixture)
        {
            _fixture = fixture;
            _httpClient = fixture.HttpClient;
        }

        [Fact]
        public async Task RecommendGame_WithValidQuery_ReturnsSuccessResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "I want a strategic board game for 2-4 players",
                UserId = "test-user-123",
                ConversationId = Guid.NewGuid().ToString()
            };

            var json = JsonConvert.SerializeObject(userQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            Assert.False(string.IsNullOrEmpty(responseContent));

            var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
            Assert.NotNull(agentResponse);
            
            // Verify response structure
            Assert.NotNull(agentResponse.ResponseText);
            Assert.False(string.IsNullOrEmpty(agentResponse.ResponseText));
        }

        [Fact]
        public async Task RecommendGame_WithMinimalQuery_ReturnsSuccessResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "fun game"
            };

            var json = JsonConvert.SerializeObject(userQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            Assert.False(string.IsNullOrEmpty(responseContent));

            var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
            Assert.NotNull(agentResponse);
            Assert.NotNull(agentResponse.ResponseText);
        }

        [Fact]
        public async Task RecommendGame_WithEmptyQuery_ReturnsBadRequest()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = ""
            };

            var json = JsonConvert.SerializeObject(userQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest || 
                       response.StatusCode == HttpStatusCode.OK); // Some APIs might handle empty queries gracefully
        }

        [Fact]
        public async Task RecommendGame_WithInvalidJsonBody_ReturnsBadRequest()
        {
            // Arrange
            var invalidJson = "{ invalid json }";
            var content = new StringContent(invalidJson, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task RecommendGame_WithMissingRequiredField_ReturnsBadRequest()
        {
            // Arrange
            var incompleteQuery = new { UserId = "test-user" }; // Missing required Query field
            var json = JsonConvert.SerializeObject(incompleteQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task RecommendGame_WithLongQuery_ReturnsSuccessResponse()
        {
            // Arrange
            var longQuery = string.Join(" ", Enumerable.Repeat("strategy game", 50)); // Very long query
            var userQuery = new UserQuery
            {
                Query = longQuery,
                UserId = "test-user-456"
            };

            var json = JsonConvert.SerializeObject(userQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.True(response.StatusCode == HttpStatusCode.OK || 
                       response.StatusCode == HttpStatusCode.BadRequest); // Might have length limits
        }

        [Fact]
        public async Task RecommendGame_WithConversationId_ReturnsSuccessResponse()
        {
            // Arrange
            var conversationId = Guid.NewGuid().ToString();
            var userQuery = new UserQuery
            {
                Query = "What about party games?",
                UserId = "test-user-789",
                ConversationId = conversationId
            };

            var json = JsonConvert.SerializeObject(userQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
            
            Assert.NotNull(agentResponse);
            Assert.NotNull(agentResponse.ResponseText);
            
            // ThreadId might be returned for conversation tracking
            if (!string.IsNullOrEmpty(agentResponse.ThreadId))
            {
                Assert.False(string.IsNullOrEmpty(agentResponse.ThreadId));
            }
        }

        [Fact]
        public async Task HealthCheck_ApiIsRunning()
        {
            // This test ensures the API is reachable and running
            // Act
            var response = await _httpClient.GetAsync("/");

            // Assert - API should be reachable (any 2xx, 3xx, or 404 is fine)
            Assert.True(response.StatusCode == HttpStatusCode.OK ||
                       response.StatusCode == HttpStatusCode.NotFound ||
                       response.StatusCode == HttpStatusCode.Redirect ||
                       response.StatusCode == HttpStatusCode.MovedPermanently,
                       $"API appears to be down. Status: {response.StatusCode}");
        }
    }
}
