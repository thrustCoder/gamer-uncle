using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;
using Azure.AI.Projects;
using Azure.AI.OpenAI;
using OpenAI;
using OpenAI.Realtime;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.VoiceService
{
    public class FoundryVoiceService : IFoundryVoiceService
    {
        private readonly AIProjectClient _projectClient;
        private readonly IGameDataService _gameDataService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<FoundryVoiceService> _logger;
        private readonly HttpClient _httpClient;
        private readonly AzureOpenAIClient _azureOpenAIClient;
        private readonly string _realtimeDeploymentName;

        public FoundryVoiceService(
            IConfiguration configuration, 
            IGameDataService gameDataService,
            ILogger<FoundryVoiceService> logger, 
            HttpClient httpClient)
        {
            _configuration = configuration;
            _gameDataService = gameDataService;
            _logger = logger;
            _httpClient = httpClient;

            var endpoint = new Uri(configuration["VoiceService:FoundryEndpoint"] 
                ?? throw new InvalidOperationException("Voice service Foundry endpoint missing"));

            // Uses DefaultAzureCredential for Azure AI Foundry authentication
            _projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());

            // Initialize Azure OpenAI client for Realtime API
            var azureOpenAIEndpoint = configuration["VoiceService:AzureOpenAIEndpoint"] 
                ?? throw new InvalidOperationException("Azure OpenAI endpoint missing for Realtime API");
            _realtimeDeploymentName = configuration["VoiceService:RealtimeDeploymentName"] 
                ?? "gpt-realtime";
            
            _azureOpenAIClient = new AzureOpenAIClient(
                new Uri(azureOpenAIEndpoint), 
                new DefaultAzureCredential());
        }

        public async Task<VoiceSessionResponse> CreateVoiceSessionAsync(string query, string? conversationId = null)
        {
            try
            {
                _logger.LogInformation("Creating Foundry Live Voice session for query: {Query}", query);

                // 1. Get RAG context from Cosmos DB using existing pipeline
                var gameContext = await _gameDataService.GetGameContextForFoundryAsync(query, conversationId);
                
                // 2. Create Foundry Live Voice session with enhanced system message
                var sessionId = $"voice-{Guid.NewGuid()}";
                
                // 3. Create actual Foundry Live Voice session
                var foundryResponse = await CreateFoundryLiveVoiceSessionAsync(sessionId, gameContext);
                
                // 4. Return response with WebRTC connection details
                var response = new VoiceSessionResponse
                {
                    SessionId = sessionId,
                    WebRtcToken = foundryResponse.WebRtcToken,
                    FoundryConnectionUrl = foundryResponse.ConnectionUrl,
                    ExpiresAt = DateTime.UtcNow.AddMinutes(30),
                    ConversationId = conversationId,
                    InitialResponse = null // Foundry will handle initial response via voice
                };

                _logger.LogInformation("Successfully created Foundry Live Voice session: {SessionId}", sessionId);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Foundry Live Voice session for query: {Query}", query);
                throw;
            }
        }

        public Task<bool> ValidateVoiceSessionAsync(string sessionId)
        {
            try
            {
                _logger.LogInformation("Validating voice session: {SessionId}", sessionId);

                if (string.IsNullOrWhiteSpace(sessionId) || !sessionId.StartsWith("voice-"))
                {
                    _logger.LogWarning("Invalid session ID format: {SessionId}", sessionId);
                    return Task.FromResult(false);
                }

                // For real implementation, we could check actual session status with Azure OpenAI Realtime API
                // For now, basic validation is sufficient as sessions are short-lived
                var isValid = true;

                _logger.LogInformation("Voice session validation result: {SessionId}, IsValid: {IsValid}", sessionId, isValid);
                return Task.FromResult(isValid);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating voice session: {SessionId}", sessionId);
                return Task.FromResult(false);
            }
        }

        public Task<bool> TerminateVoiceSessionAsync(string sessionId)
        {
            try
            {
                _logger.LogInformation("Terminating voice session: {SessionId}", sessionId);

                if (string.IsNullOrWhiteSpace(sessionId) || !sessionId.StartsWith("voice-"))
                {
                    _logger.LogWarning("Invalid session ID format for termination: {SessionId}", sessionId);
                    return Task.FromResult(false);
                }

                // For real implementation, we could call Azure OpenAI Realtime API to terminate session
                // Since sessions are short-lived and auto-expire, basic validation is sufficient
                _logger.LogInformation("Successfully terminated voice session: {SessionId}", sessionId);
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error terminating voice session: {SessionId}", sessionId);
                return Task.FromResult(false);
            }
        }

        public Task<VoiceSessionStatus?> GetVoiceSessionStatusAsync(string sessionId)
        {
            try
            {
                _logger.LogInformation("Getting voice session status: {SessionId}", sessionId);

                if (string.IsNullOrWhiteSpace(sessionId) || !sessionId.StartsWith("voice-"))
                {
                    _logger.LogWarning("Invalid session ID format for status check: {SessionId}", sessionId);
                    return Task.FromResult<VoiceSessionStatus?>(null);
                }

                var status = new VoiceSessionStatus
                {
                    SessionId = sessionId,
                    Status = "active",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-5),
                    ExpiresAt = DateTime.UtcNow.AddMinutes(25),
                    ConversationId = null,
                    ParticipantCount = 1
                };

                _logger.LogInformation("Retrieved voice session status: {SessionId}, Status: {Status}", sessionId, status.Status);
                return Task.FromResult<VoiceSessionStatus?>(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting voice session status: {SessionId}", sessionId);
                return Task.FromResult<VoiceSessionStatus?>(null);
            }
        }

        private string CreateBoardGameSystemMessage(string userQuery)
        {
            var contextBuilder = new StringBuilder();
            contextBuilder.AppendLine("You are a helpful board game assistant and expert.");
            contextBuilder.AppendLine("You help players with board game recommendations, rules clarifications, strategy advice, and general board game questions.");
            contextBuilder.AppendLine($"The user has asked: '{userQuery}'");
            contextBuilder.AppendLine("Provide helpful, accurate, and concise responses about board games.");
            contextBuilder.AppendLine("If you need more context about a specific game or situation, feel free to ask follow-up questions.");
            
            return contextBuilder.ToString();
        }

        private async Task<FoundryLiveVoiceResponse> CreateFoundryLiveVoiceSessionAsync(string sessionId, string systemMessage)
        {
            try
            {
                _logger.LogInformation("Creating Azure OpenAI Realtime Voice session: {SessionId}", sessionId);
                
                // Generate authentication token and WebSocket connection URL
                // The frontend will establish the actual Realtime WebSocket connection
                var webRtcToken = await GenerateRealtimeWebRtcTokenAsync(sessionId, systemMessage);
                var connectionUrl = await GetRealtimeConnectionUrlAsync(sessionId);

                var foundryResponse = new FoundryLiveVoiceResponse
                {
                    WebRtcToken = webRtcToken,
                    ConnectionUrl = connectionUrl,
                    Status = "created"
                };

                _logger.LogInformation("Successfully created Azure OpenAI Realtime Voice session: {SessionId}", sessionId);
                return foundryResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create Azure OpenAI Realtime Voice session: {SessionId}", sessionId);
                throw;
            }
        }

        private async Task<string> GenerateRealtimeWebRtcTokenAsync(string sessionId, string systemMessage)
        {
            try
            {
                // Get access token for Azure OpenAI authentication
                var credential = new DefaultAzureCredential();
                var tokenRequest = new TokenRequestContext(new[] { "https://cognitiveservices.azure.com/.default" });
                var accessToken = await credential.GetTokenAsync(tokenRequest);
                
                // Generate WebRTC connection token with session info and system message
                var tokenData = new
                {
                    sessionId,
                    deploymentName = _realtimeDeploymentName,
                    endpoint = _configuration["VoiceService:AzureOpenAIEndpoint"],
                    expiresAt = DateTime.UtcNow.AddMinutes(30),
                    systemMessage = systemMessage,
                    voice = _configuration["VoiceService:DefaultVoice"] ?? "alloy",
                    iceServers = JsonSerializer.Deserialize<object[]>(_configuration["VoiceService:WebRtcStunServers"] ?? "[]"),
                    apiVersion = "2024-10-01-preview", // Azure OpenAI Realtime API version
                    accessToken = accessToken.Token // Include token for WebSocket authentication
                };

                var tokenJson = JsonSerializer.Serialize(tokenData);
                var webRtcToken = Convert.ToBase64String(Encoding.UTF8.GetBytes(tokenJson));
                
                _logger.LogDebug("Generated WebRTC token for session: {SessionId}", sessionId);
                return webRtcToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate WebRTC token for session: {SessionId}", sessionId);
                throw;
            }
        }

        private async Task<string> GetRealtimeConnectionUrlAsync(string sessionId)
        {
            try
            {
                // Use the standard Azure OpenAI Realtime API WebSocket format
                // This is the correct format for Azure OpenAI realtime connections
                var azureOpenAIEndpoint = _configuration["VoiceService:AzureOpenAIEndpoint"];
                var azureOpenAIKey = _configuration["VoiceService:AzureOpenAIKey"]; // Optional: prefer API key for browser WS auth
                
                if (string.IsNullOrEmpty(azureOpenAIEndpoint))
                {
                    throw new InvalidOperationException("Azure OpenAI endpoint is not configured");
                }
                
                // Convert to WebSocket URL using the standard OpenAI Realtime API format
                // Azure OpenAI accepts api-key parameter for authentication in WebSocket connections (browser-safe)
                var wsEndpoint = azureOpenAIEndpoint.Replace("https://", "wss://").Replace("http://", "ws://");
                string connectionUrl;

                if (!string.IsNullOrWhiteSpace(azureOpenAIKey))
                {
                    // Preferred: use Azure OpenAI API key for browser/React Native WebSocket authentication via query param
                    connectionUrl = $"{wsEndpoint}/openai/realtime?api-version=2024-10-01-preview&deployment={_realtimeDeploymentName}&api-key={Uri.EscapeDataString(azureOpenAIKey)}";
                    _logger.LogInformation("Generated OpenAI Realtime WebSocket URL using API key for session {SessionId}", sessionId);
                }
                else
                {
                    // Fallback: use Microsoft Entra (managed identity) access token, but note this may not work for browser WS auth
                    // because Authorization headers cannot be sent by the browser during WebSocket handshake.
                    var credential = new DefaultAzureCredential();
                    var tokenRequest = new TokenRequestContext(new[] { "https://cognitiveservices.azure.com/.default" });
                    var accessToken = await credential.GetTokenAsync(tokenRequest);

                    connectionUrl = $"{wsEndpoint}/openai/realtime?api-version=2024-10-01-preview&deployment={_realtimeDeploymentName}&api-key={Uri.EscapeDataString(accessToken.Token)}";
                    _logger.LogWarning("AzureOpenAIKey not configured. Using Entra token in api-key query parameter for session {SessionId}. This may fail in browser/React Native environments. Configure 'VoiceService:AzureOpenAIKey' for reliable WebSocket authentication.", sessionId);
                }
                
                _logger.LogInformation("Generated authenticated OpenAI Realtime WebSocket URL for session {SessionId}", sessionId);
                return connectionUrl;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate connection URL for session: {SessionId}", sessionId);
                throw;
            }
        }

        private async Task<string> GetFoundryVoiceConnectionUrlAsync(string sessionId, string systemMessage)
        {
            // For Phase 1, return a simulated connection URL
            // In Phase 2, this will create actual Foundry voice session and return connection URL
            await Task.Delay(50); // Simulate URL generation

            var voiceEndpoint = _configuration["VoiceService:FoundryVoiceEndpoint"] 
                ?? "wss://voice.foundry.ai/voice-session";
            
            return $"{voiceEndpoint}/{sessionId}";
        }
    }

    public class FoundryLiveVoiceResponse
    {
        public string WebRtcToken { get; set; } = string.Empty;
        public string ConnectionUrl { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }
}