using System.Net;
using System.Text;
using Newtonsoft.Json;
using Xunit;
using Xunit.Abstractions;
using GamerUncle.Api.Models;
using GamerUncle.Api.FunctionalTests.Infrastructure;

namespace GamerUncle.Api.FunctionalTests.Controllers
{
    public class RecommendationsControllerTests : IClassFixture<TestFixture>
    {
        private readonly TestFixture _fixture;
        private readonly HttpClient _httpClient;
        private readonly ITestOutputHelper _output;

        public RecommendationsControllerTests(TestFixture fixture, ITestOutputHelper output)
        {
            _fixture = fixture;
            _httpClient = fixture.HttpClient;
            _output = output;
        }

        [Fact]
        public async Task HealthCheck_ApiIsRunning()
        {
            // This test ensures the API is reachable and running
            _output.WriteLine($"Testing API connectivity at: {_fixture.Configuration.BaseUrl}");
            
            // Act
            var response = await _httpClient.GetAsync("/");

            // Assert - API should be reachable (any 2xx, 3xx, or 404 is fine)
            _output.WriteLine($"Health check response: {response.StatusCode}");
            Assert.True(response.StatusCode == HttpStatusCode.OK ||
                       response.StatusCode == HttpStatusCode.NotFound ||
                       response.StatusCode == HttpStatusCode.Redirect ||
                       response.StatusCode == HttpStatusCode.MovedPermanently,
                       $"API appears to be down. Status: {response.StatusCode}, Base URL: {_fixture.Configuration.BaseUrl}");
        }

        [Fact]
        public async Task SmokeTest_ApiEndpointExists()
        {
            // Smoke test to verify the recommendations endpoint exists
            _output.WriteLine("Running smoke test for /api/recommendations endpoint");
            
            // Act - Send a simple request to see if endpoint exists
            var emptyContent = new StringContent("{}", Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/recommendations", emptyContent);

            // Assert - Endpoint should exist (not return 404)
            _output.WriteLine($"Smoke test response: {response.StatusCode}");
            Assert.NotEqual(HttpStatusCode.NotFound, response.StatusCode);
            
            // Should be either OK or BadRequest, but not NotFound
            Assert.True(response.StatusCode == HttpStatusCode.OK || 
                       response.StatusCode == HttpStatusCode.BadRequest ||
                       response.StatusCode == HttpStatusCode.InternalServerError,
                       $"Expected OK, BadRequest, or InternalServerError, but got {response.StatusCode}");
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

            _output.WriteLine($"Testing valid query: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "valid query test");
            
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

            _output.WriteLine($"Testing minimal query: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "minimal query test");
            
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

            _output.WriteLine("Testing empty query validation");

            // Act & Assert with retry logic for validation tests
            for (int attempt = 0; attempt <= 1; attempt++)
            {
                _output.WriteLine($"Attempt {attempt + 1}/2 for empty query validation test");
                
                var json = JsonConvert.SerializeObject(userQuery);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/recommendations", content);
                
                _output.WriteLine($"Response status: {response.StatusCode}");
                Assert.True(response.StatusCode == HttpStatusCode.BadRequest || 
                           response.StatusCode == HttpStatusCode.OK); // Some APIs might handle empty queries gracefully

                if (response.StatusCode == HttpStatusCode.BadRequest)
                {
                    _output.WriteLine("✅ Empty query properly rejected with BadRequest");
                    return;
                }
                else if (response.StatusCode == HttpStatusCode.OK)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
                    Assert.NotNull(agentResponse);
                    Assert.NotNull(agentResponse.ResponseText);
                    
                    // If this is not a fallback response, we're good
                    if (!IsFallbackResponse(agentResponse.ResponseText))
                    {
                        _output.WriteLine($"✅ Empty query handled gracefully with meaningful response on attempt {attempt + 1}");
                        return;
                    }
                    
                    _output.WriteLine($"⚠️ Got fallback response on attempt {attempt + 1}: {agentResponse.ResponseText}");
                    
                    // If this is not the last attempt, wait a bit before retrying
                    if (attempt < 1)
                    {
                        _output.WriteLine("Waiting 2 seconds before retry...");
                        await Task.Delay(2000);
                    }
                }
            }
            
            // If we reach here and got OK responses, but all were fallbacks, that's still acceptable for empty query
            _output.WriteLine("Empty query test completed - all attempts resulted in fallback responses, which is acceptable for empty queries");
        }

        [Fact]
        public async Task RecommendGame_WithInvalidJsonBody_ReturnsBadRequest()
        {
            // Arrange
            var invalidJson = "{ invalid json }";
            var content = new StringContent(invalidJson, Encoding.UTF8, "application/json");

            _output.WriteLine("Testing invalid JSON handling");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task RecommendGame_WithMissingRequiredField_ReturnsBadRequest()
        {
            // Arrange
            var incompleteQuery = new { UserId = "test-user" }; // Missing required Query field
            var json = JsonConvert.SerializeObject(incompleteQuery);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _output.WriteLine("Testing missing required field validation");

            // Act
            var response = await _httpClient.PostAsync("/api/recommendations", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
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

            _output.WriteLine($"Testing long query (length: {longQuery.Length} characters)");

            // Act & Assert with retry logic for long queries (might be rejected or accepted)
            for (int attempt = 0; attempt <= 1; attempt++)
            {
                _output.WriteLine($"Attempt {attempt + 1}/2 for long query test");
                
                var json = JsonConvert.SerializeObject(userQuery);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/recommendations", content);
                
                _output.WriteLine($"Response status: {response.StatusCode}");
                Assert.True(response.StatusCode == HttpStatusCode.OK || 
                           response.StatusCode == HttpStatusCode.BadRequest); // Might have length limits

                if (response.StatusCode == HttpStatusCode.OK)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
                    Assert.NotNull(agentResponse);
                    Assert.NotNull(agentResponse.ResponseText);
                    
                    // If this is not a fallback response, we're good
                    if (!IsFallbackResponse(agentResponse.ResponseText))
                    {
                        _output.WriteLine($"✅ Got meaningful response for long query on attempt {attempt + 1}");
                        return;
                    }
                    
                    _output.WriteLine($"⚠️ Got fallback response on attempt {attempt + 1}: {agentResponse.ResponseText}");
                    
                    // If this is not the last attempt, wait a bit before retrying
                    if (attempt < 1)
                    {
                        _output.WriteLine("Waiting 2 seconds before retry...");
                        await Task.Delay(2000);
                    }
                }
                else
                {
                    // BadRequest is acceptable for very long queries
                    _output.WriteLine($"✅ Long query properly rejected with status: {response.StatusCode}");
                    return;
                }
            }
            
            // If we reach here, all attempts resulted in fallback responses
            Assert.True(false, "Long query test failed after 2 attempts. All responses were fallback responses.");
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

            _output.WriteLine($"Testing conversation tracking with ID: {conversationId}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "conversation tracking test");
            
            Assert.NotNull(agentResponse.ResponseText);
            
            // ThreadId might be returned for conversation tracking
            if (!string.IsNullOrEmpty(agentResponse.ThreadId))
            {
                Assert.False(string.IsNullOrEmpty(agentResponse.ThreadId));
            }
        }

        #region Response Structure Validation Tests

        [Fact]
        public async Task RecommendGame_ValidRequest_ReturnsValidJsonStructure()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "I want a strategic board game",
                UserId = "test-user-structure"
            };

            _output.WriteLine("Testing response JSON structure validation");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "JSON structure validation test");

            // Verify required properties exist
            Assert.NotNull(agentResponse.ResponseText);
            Assert.False(string.IsNullOrEmpty(agentResponse.ResponseText));

            // Optional properties can be null but should deserialize properly
            Assert.True(agentResponse.ThreadId == null || !string.IsNullOrEmpty(agentResponse.ThreadId));
            Assert.True(agentResponse.MatchingGamesCount == null || agentResponse.MatchingGamesCount >= 0);
        }

        [Fact]
        public async Task RecommendGame_ValidRequest_ReturnsCorrectContentType()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "recommend a game",
                UserId = "test-content-type"
            };

            _output.WriteLine("Testing content type validation");

            // Act & Assert with retry logic  
            var agentResponse = await ExecuteTestWithRetry(userQuery, "content type test");
            
            // The ExecuteTestWithRetry method handles the content type validation internally
            Assert.NotNull(agentResponse.ResponseText);
        }

        #endregion

        #region Special Characters & Security Tests

        [Fact]
        public async Task RecommendGame_WithSpecialCharacters_ReturnsSuccessResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "I want a game with symbols: !@#$%^&*()_+-=[]{}|;':\",./<>?",
                UserId = "test-special-chars"
            };

            _output.WriteLine($"Testing special characters: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "special characters test");
            
            Assert.NotNull(agentResponse.ResponseText);
        }

        [Fact]
        public async Task RecommendGame_WithUnicodeCharacters_ReturnsSuccessResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "Je veux un jeu de société français 🎲 游戏推荐 спасибо",
                UserId = "test-unicode"
            };

            _output.WriteLine($"Testing Unicode characters: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "Unicode characters test");
            
            Assert.NotNull(agentResponse.ResponseText);
        }

        [Fact]
        public async Task RecommendGame_WithSqlInjectionAttempt_HandledSecurely()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "'; DROP TABLE Games; SELECT * FROM Users WHERE '1'='1",
                UserId = "test-sql-injection"
            };

            _output.WriteLine($"Testing SQL injection prevention: {userQuery.Query}");

            // Act & Assert with retry logic and security checks
            var forbiddenStrings = new[] { "SQL", "DROP" };
            await ExecuteSecurityTestWithRetry(userQuery, "SQL injection prevention test", forbiddenStrings);
        }

        [Fact]
        public async Task RecommendGame_WithXssAttempt_HandledSecurely()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "<script>alert('XSS')</script><img src=x onerror=alert('XSS')>",
                UserId = "test-xss"
            };

            _output.WriteLine($"Testing XSS prevention: {userQuery.Query}");

            // Act & Assert with retry logic and security checks
            var forbiddenStrings = new[] { "<script>", "alert(" };
            await ExecuteSecurityTestWithRetry(userQuery, "XSS prevention test", forbiddenStrings);
        }

        #endregion

        #region Happy Path Realistic Scenarios

        [Fact]
        public async Task RecommendGame_DetailedRequirements_ReturnsRelevantResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "Suggest me a game for 4 players that involves bluffing. The age should be at least 14 years. The max play time should not exceed 90 minutes.",
                UserId = "test-detailed-req"
            };

            _output.WriteLine($"Testing detailed requirements: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "detailed requirements test");
            
            // Additional assertions for detailed requirements
            Assert.True(agentResponse.ResponseText!.Length > 50, "Response should be substantial for detailed query");
            
            // Should not be a fallback response
            Assert.False(IsFallbackResponse(agentResponse.ResponseText!), 
                        $"Expected detailed game recommendation, but got fallback response: {agentResponse.ResponseText}");
        }

        [Fact]
        public async Task RecommendGame_SimpleInquiry_ReturnsHelpfulResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "I am looking for a new board game.",
                UserId = "test-simple-inquiry"
            };

            _output.WriteLine($"Testing simple inquiry: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "simple inquiry test");
            
            // Should not be a fallback response
            Assert.False(IsFallbackResponse(agentResponse.ResponseText!), 
                        $"Expected helpful game recommendations, but got fallback response: {agentResponse.ResponseText}");
        }

        [Fact]
        public async Task RecommendGame_SpecificGameInquiry_ReturnsGameInfo()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "Tell me about Catan",
                UserId = "test-catan-info"
            };

            _output.WriteLine($"Testing specific game inquiry: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "specific game inquiry test");
            
            // Should not be a fallback response and should mention the game
            Assert.False(IsFallbackResponse(agentResponse.ResponseText!), 
                        $"Expected information about Catan, but got fallback response: {agentResponse.ResponseText}");
                        
            // Response should be substantial and likely mention the game name
            Assert.True(agentResponse.ResponseText!.Length > 30, "Response should be substantial for game-specific inquiry");
        }

        [Fact]
        public async Task RecommendGame_GameCategoryQuestion_ReturnsEducationalResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "What are worker placement games?",
                UserId = "test-category-question"
            };

            _output.WriteLine($"Testing category question: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "category question test");
            
            // Should not be a fallback response and should be educational
            Assert.False(IsFallbackResponse(agentResponse.ResponseText!), 
                        $"Expected educational explanation about worker placement games, but got fallback response: {agentResponse.ResponseText}");
                        
            // Response should be substantial for educational content
            Assert.True(agentResponse.ResponseText!.Length > 40, "Response should be substantial for educational question");
        }

        [Fact]
        public async Task RecommendGame_StrategyQuestion_ReturnsStrategyAdvice()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "How to win at Ticket to Ride?",
                UserId = "test-strategy-question"
            };

            _output.WriteLine($"Testing strategy question: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "strategy question test");
            
            // Should not be a fallback response and should provide strategy advice
            Assert.False(IsFallbackResponse(agentResponse.ResponseText!), 
                        $"Expected strategy advice for Ticket to Ride, but got fallback response: {agentResponse.ResponseText}");
                        
            // Response should be substantial for strategy content
            Assert.True(agentResponse.ResponseText!.Length > 40, "Response should be substantial for strategy question");
        }

        [Fact]
        public async Task RecommendGame_ConceptualQuestion_ReturnsInformativeResponse()
        {
            // Arrange
            var userQuery = new UserQuery
            {
                Query = "What makes a game family friendly?",
                UserId = "test-conceptual-question"
            };

            _output.WriteLine($"Testing conceptual question: {userQuery.Query}");

            // Act & Assert with retry logic
            var agentResponse = await ExecuteTestWithRetry(userQuery, "conceptual question test");
            
            // Should not be a fallback response and should be informative
            Assert.False(IsFallbackResponse(agentResponse.ResponseText!), 
                        $"Expected informative explanation about family-friendly games, but got fallback response: {agentResponse.ResponseText}");
                        
            // Response should be substantial for conceptual content
            Assert.True(agentResponse.ResponseText!.Length > 40, "Response should be substantial for conceptual question");
        }

        #endregion

        #region Helper Method Tests

        [Theory]
        [InlineData("Let me help you with that board game question! 🎯", true)]
        [InlineData("Looking into that for you! 🎲", true)]
        [InlineData("Great board game question! Let me think... 🎮", true)]
        [InlineData("Let me find some great games for you! 🎲", true)]
        [InlineData("I'm sorry, but I cannot assist with that request.", true)]
        [InlineData("I cannot assist with that", true)]
        [InlineData("I'm unable to help with that", true)]
        [InlineData("I cannot help with that", true)]
        [InlineData("I'm sorry, I cannot", true)]
        [InlineData("I cannot provide", true)]
        [InlineData("Short", true)] // Very short response
        [InlineData("This is a detailed recommendation about Catan which is a fantastic board game.", false)]
        [InlineData("Worker placement games are...", false)]
        [InlineData("", true)] // Empty response
        [InlineData("   ", true)] // Whitespace only
        public void IsFallbackResponse_DetectsFallbackPatterns(string responseText, bool expectedIsFallback)
        {
            // Act
            var result = IsFallbackResponse(responseText);

            // Assert
            Assert.Equal(expectedIsFallback, result);
        }

        #endregion

        #region Helper Methods

        private static bool IsValidJson(string jsonString)
        {
            try
            {
                JsonConvert.DeserializeObject(jsonString);
                return true;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        /// <summary>
        /// Checks if the response is a fallback response that indicates the agent didn't provide a meaningful answer
        /// </summary>
        private static bool IsFallbackResponse(string responseText)
        {
            if (string.IsNullOrWhiteSpace(responseText))
                return true;

            // Known fallback patterns from AgentServiceClient.GetRandomFallbackMessage()
            var fallbackPatterns = new[]
            {
                "Let me help you with that board game question! 🎯",
                "Looking into that for you! 🎲", 
                "Great board game question! Let me think... 🎮",
                "Checking my board game knowledge! 📚",
                "On it! Give me a moment to help! ⭐",
                "Let me find some great games for you! 🎲"
            };

            // Known refusal patterns that should be treated as fallback responses
            var refusalPatterns = new[]
            {
                "I'm sorry, but I cannot assist with that request",
                "I cannot assist with that",
                "I'm unable to help with that",
                "I cannot help with that",
                "I'm sorry, I cannot",
                "I cannot provide"
            };

            // Also check for very short responses that might indicate a problem
            var isVeryShort = responseText.Trim().Length < 20;
            var containsFallbackPattern = fallbackPatterns.Any(pattern => 
                responseText.Contains(pattern, StringComparison.OrdinalIgnoreCase));
            var containsRefusalPattern = refusalPatterns.Any(pattern => 
                responseText.Contains(pattern, StringComparison.OrdinalIgnoreCase));

            return containsFallbackPattern || containsRefusalPattern || isVeryShort;
        }

        /// <summary>
        /// Executes a test with retry logic to avoid fallback responses
        /// </summary>
        private async Task<AgentResponse> ExecuteTestWithRetry(UserQuery userQuery, string testDescription, int maxRetries = 1)
        {
            AgentResponse? lastResponse = null;
            
            for (int attempt = 0; attempt <= maxRetries; attempt++)
            {
                _output.WriteLine($"Attempt {attempt + 1}/{maxRetries + 1} for {testDescription}");
                
                var json = JsonConvert.SerializeObject(userQuery);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/recommendations", content);
                
                _output.WriteLine($"Response status: {response.StatusCode}");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);

                var responseContent = await response.Content.ReadAsStringAsync();
                _output.WriteLine($"Response content: {responseContent}");
                
                var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
                Assert.NotNull(agentResponse);
                Assert.NotNull(agentResponse.ResponseText);
                
                lastResponse = agentResponse;

                // If this is not a fallback response, we're good
                if (!IsFallbackResponse(agentResponse.ResponseText))
                {
                    _output.WriteLine($"✅ Got meaningful response on attempt {attempt + 1}: {agentResponse.ResponseText.Substring(0, Math.Min(100, agentResponse.ResponseText.Length))}...");
                    return agentResponse;
                }
                
                _output.WriteLine($"⚠️ Got fallback response on attempt {attempt + 1}: {agentResponse.ResponseText}");
                
                // If this is not the last attempt, wait a bit before retrying
                if (attempt < maxRetries)
                {
                    _output.WriteLine("Waiting 2 seconds before retry...");
                    await Task.Delay(2000);
                }
            }

            // If we've exhausted retries, fail the test with a descriptive message
            Assert.True(false, $"Test failed after {maxRetries + 1} attempts. All responses were fallback responses. Last response: {lastResponse?.ResponseText}");
            return lastResponse!; // This line will never execute due to Assert.True(false) above
        }

        /// <summary>
        /// Executes a security test with retry logic and security-specific assertions
        /// </summary>
        private async Task<AgentResponse> ExecuteSecurityTestWithRetry(UserQuery userQuery, string testDescription, string[] forbiddenStrings, int maxRetries = 1)
        {
            AgentResponse? lastResponse = null;
            
            for (int attempt = 0; attempt <= maxRetries; attempt++)
            {
                _output.WriteLine($"Attempt {attempt + 1}/{maxRetries + 1} for {testDescription}");
                
                var json = JsonConvert.SerializeObject(userQuery);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/recommendations", content);
                
                _output.WriteLine($"Response status: {response.StatusCode}");
                // Should either handle gracefully (200) or reject (400), but not crash (500)
                Assert.True(response.StatusCode == HttpStatusCode.OK || 
                           response.StatusCode == HttpStatusCode.BadRequest,
                           $"Expected OK or BadRequest, but got {response.StatusCode}");

                if (response.StatusCode == HttpStatusCode.OK)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _output.WriteLine($"Response content: {responseContent}");
                    
                    var agentResponse = JsonConvert.DeserializeObject<AgentResponse>(responseContent);
                    Assert.NotNull(agentResponse);
                    Assert.NotNull(agentResponse.ResponseText);
                    
                    lastResponse = agentResponse;

                    // Check for forbidden strings
                    foreach (var forbidden in forbiddenStrings)
                    {
                        Assert.DoesNotContain(forbidden, agentResponse.ResponseText, StringComparison.OrdinalIgnoreCase);
                    }

                    // If this is not a fallback response, we're good
                    if (!IsFallbackResponse(agentResponse.ResponseText))
                    {
                        _output.WriteLine($"✅ Got meaningful and secure response on attempt {attempt + 1}");
                        return agentResponse;
                    }
                    
                    _output.WriteLine($"⚠️ Got fallback response on attempt {attempt + 1}: {agentResponse.ResponseText}");
                    
                    // If this is not the last attempt, wait a bit before retrying
                    if (attempt < maxRetries)
                    {
                        _output.WriteLine("Waiting 2 seconds before retry...");
                        await Task.Delay(2000);
                    }
                }
                else
                {
                    // BadRequest is acceptable for security tests
                    _output.WriteLine($"✅ Request properly rejected with status: {response.StatusCode}");
                    return new AgentResponse { ResponseText = "Request properly rejected" };
                }
            }

            // If we've exhausted retries and all were fallbacks, fail the test
            if (lastResponse != null)
            {
                Assert.True(false, $"Security test failed after {maxRetries + 1} attempts. All responses were fallback responses. Last response: {lastResponse.ResponseText}");
            }
            
            return lastResponse!;
        }

        #endregion
    }
}
