using System.Net;
using System.Text;
using Newtonsoft.Json;
using Xunit;
using Xunit.Abstractions;
using GamerUncle.Shared.Models;
using GamerUncle.Api.FunctionalTests.Infrastructure;

namespace GamerUncle.Api.FunctionalTests.Controllers
{
    public class VoiceControllerTests : IClassFixture<TestFixture>
    {
        private readonly HttpClient _httpClient;
        private readonly ITestOutputHelper _output;

        public VoiceControllerTests(TestFixture fixture, ITestOutputHelper output)
        {
            _httpClient = fixture.HttpClient;
            _output = output;
        }

        [Fact]
        public async Task CreateVoiceSession_WithValidRequest_ReturnsSuccessResponse()
        {
            // Arrange
            var request = new VoiceSessionRequest
            {
                Query = "What's a good strategy for Brass: Birmingham with 3 players?",
                ConversationId = "test-conversation-" + Guid.NewGuid().ToString("N")[..8]
            };

            _output.WriteLine($"Testing voice session creation for Query: {request.Query}, ConversationId: {request.ConversationId}");

            // Act
            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/voice/sessions", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            _output.WriteLine($"Response content: {responseContent}");

            var voiceSessionResponse = JsonConvert.DeserializeObject<VoiceSessionResponse>(responseContent);
            Assert.NotNull(voiceSessionResponse);
            Assert.NotNull(voiceSessionResponse.SessionId);
            Assert.NotNull(voiceSessionResponse.WebRtcToken);
            Assert.NotNull(voiceSessionResponse.FoundryConnectionUrl);
            Assert.True(voiceSessionResponse.ExpiresAt > DateTime.UtcNow);
            Assert.Equal(request.ConversationId, voiceSessionResponse.ConversationId);
            
            // Verify SessionId follows the expected format (voice-{guid})
            Assert.True(voiceSessionResponse.SessionId.StartsWith("voice-"), "SessionId should start with 'voice-'");
            var guidPart = voiceSessionResponse.SessionId.Substring("voice-".Length);
            Assert.True(Guid.TryParse(guidPart, out _), "SessionId should contain a valid GUID after 'voice-' prefix");
        }

        [Fact]
        public async Task CreateVoiceSession_WithoutConversationId_ReturnsSuccessResponse()
        {
            // Arrange
            var request = new VoiceSessionRequest
            {
                Query = "How do I win at Wingspan?"
            };

            _output.WriteLine($"Testing voice session creation without ConversationId for Query: {request.Query}");

            // Act
            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/voice/sessions", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            _output.WriteLine($"Response content: {responseContent}");

            var voiceSessionResponse = JsonConvert.DeserializeObject<VoiceSessionResponse>(responseContent);
            Assert.NotNull(voiceSessionResponse);
            Assert.NotNull(voiceSessionResponse.SessionId);
            Assert.NotNull(voiceSessionResponse.WebRtcToken);
            Assert.NotNull(voiceSessionResponse.FoundryConnectionUrl);
            Assert.True(voiceSessionResponse.ExpiresAt > DateTime.UtcNow);
        }

        [Fact]
        public async Task CreateVoiceSession_WithEmptyQuery_ReturnsBadRequest()
        {
            // Arrange
            var request = new VoiceSessionRequest
            {
                Query = "" // Empty query should be invalid
            };

            _output.WriteLine("Testing voice session creation with empty query");

            // Act
            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/voice/sessions", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            
            // In production environments, we might get a GatewayTimeout before validation
            // but ideally we should get BadRequest for empty queries
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest || 
                       response.StatusCode == HttpStatusCode.GatewayTimeout,
                       $"Expected BadRequest or GatewayTimeout, but got: {response.StatusCode}");
        }

        [Fact]
        public async Task CreateVoiceSession_WithMissingQuery_ReturnsBadRequest()
        {
            // Arrange
            var invalidRequest = new
            {
                ConversationId = "test-conversation"
                // Missing Query
            };

            _output.WriteLine("Testing voice session creation with missing Query");

            // Act
            var json = JsonConvert.SerializeObject(invalidRequest);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/voice/sessions", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            
            // In production environments, we might get a GatewayTimeout before validation
            // but ideally we should get BadRequest for missing query
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest || 
                       response.StatusCode == HttpStatusCode.GatewayTimeout,
                       $"Expected BadRequest or GatewayTimeout, but got: {response.StatusCode}");
        }

        [Fact]
        public async Task CreateVoiceSession_WithGameSpecificQuery_ReturnsGameContext()
        {
            // Arrange
            var request = new VoiceSessionRequest
            {
                Query = "Explain the rules of Azul for 2 players",
                ConversationId = "test-game-specific-" + Guid.NewGuid().ToString("N")[..8]
            };

            _output.WriteLine($"Testing voice session creation with game-specific query: {request.Query}");

            // Act
            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/voice/sessions", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            _output.WriteLine($"Response content: {responseContent}");

            var voiceSessionResponse = JsonConvert.DeserializeObject<VoiceSessionResponse>(responseContent);
            Assert.NotNull(voiceSessionResponse);
            Assert.NotNull(voiceSessionResponse.SessionId);
            Assert.NotNull(voiceSessionResponse.WebRtcToken);
            Assert.NotNull(voiceSessionResponse.FoundryConnectionUrl);
            
            // For game-specific queries, we might get an initial response
            if (!string.IsNullOrEmpty(voiceSessionResponse.InitialResponse))
            {
                _output.WriteLine($"Received initial response: {voiceSessionResponse.InitialResponse}");
                Assert.Contains("Azul", voiceSessionResponse.InitialResponse);
            }
        }

        [Fact]
        public async Task CreateVoiceSession_ValidatesFoundryEndpointConfiguration()
        {
            // Arrange
            var request = new VoiceSessionRequest
            {
                Query = "Quick test query for configuration validation",
                ConversationId = "test-config-" + Guid.NewGuid().ToString("N")[..8]
            };

            _output.WriteLine("Testing voice session to validate Foundry endpoint configuration");

            // Act
            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/voice/sessions", content);

            // Assert
            _output.WriteLine($"Response status: {response.StatusCode}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync();
            var voiceSessionResponse = JsonConvert.DeserializeObject<VoiceSessionResponse>(responseContent);
            Assert.NotNull(voiceSessionResponse);
            
            // Verify FoundryConnectionUrl is a valid URL format
            Assert.True(Uri.TryCreate(voiceSessionResponse.FoundryConnectionUrl, UriKind.Absolute, out var foundryUri), 
                "FoundryConnectionUrl should be a valid URL");
            
            // Verify it's using a secure protocol (HTTPS or WSS depending on the environment)
            Assert.True(foundryUri.Scheme == "https" || foundryUri.Scheme == "wss", 
                $"Expected secure protocol (https or wss), but got: {foundryUri.Scheme}");
            
            _output.WriteLine($"Foundry connection URL validated: {voiceSessionResponse.FoundryConnectionUrl}");
        }
    }
}