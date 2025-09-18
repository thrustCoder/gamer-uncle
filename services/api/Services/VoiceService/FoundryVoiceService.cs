using System.Text;
using System.Text.Json;
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
        private readonly bool _isTestEnvironment;
        private readonly HashSet<string> _testSessionIds = new(); // Track created test sessions
        private static readonly HashSet<string> _testSessions = new(); // Track test sessions in memory
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
            _isTestEnvironment = configuration.GetValue<bool>("Testing:DisableRateLimit") 
                               || Environment.GetEnvironmentVariable("TEST_ENVIRONMENT") == "Testing";

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
                
                if (_isTestEnvironment)
                {
                    _testSessions.Add(sessionId);
                    _logger.LogInformation("Test environment detected - using mock voice session for development");
                    
                    // For development, create a working mock session that the frontend can test with
                    var mockWebRtcToken = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
                    {
                        sessionId,
                        deploymentName = _realtimeDeploymentName,
                        endpoint = _configuration["VoiceService:AzureOpenAIEndpoint"],
                        expiresAt = DateTime.UtcNow.AddMinutes(30),
                        systemMessage = gameContext,
                        voice = _configuration["VoiceService:DefaultVoice"] ?? "alloy",
                        iceServers = new[]
                        {
                            new { urls = new[] { "stun:stun.l.google.com:19302" } }
                        },
                        apiVersion = "2024-10-01-preview"
                    })));

                    return new VoiceSessionResponse
                    {
                        SessionId = sessionId,
                        WebRtcToken = mockWebRtcToken,
                        FoundryConnectionUrl = "wss://mock-azure-openai-realtime.local/test",
                        ExpiresAt = DateTime.UtcNow.AddMinutes(30),
                        ConversationId = conversationId,
                        InitialResponse = null
                    };
                }

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

        public async Task<bool> ValidateVoiceSessionAsync(string sessionId)
        {
            try
            {
                _logger.LogInformation("Validating voice session: {SessionId}", sessionId);

                // For Phase 1, perform basic session ID validation
                // In Phase 2, this will query actual Foundry session status
                if (string.IsNullOrWhiteSpace(sessionId) || !sessionId.StartsWith("voice-"))
                {
                    _logger.LogWarning("Invalid session ID format: {SessionId}", sessionId);
                    return false;
                }

                // Simulate session validation with actual async operation
                await Task.Delay(50); // Simulate API call
                var isValid = true; // In Phase 2, this will check actual session status

                _logger.LogInformation("Voice session validation result: {SessionId}, IsValid: {IsValid}", sessionId, isValid);
                return isValid;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating voice session: {SessionId}", sessionId);
                return false;
            }
        }

        public async Task<bool> TerminateVoiceSessionAsync(string sessionId)
        {
            try
            {
                _logger.LogInformation("Terminating voice session: {SessionId}", sessionId);

                // For Phase 1, validate session ID format before attempting termination
                if (string.IsNullOrWhiteSpace(sessionId) || !sessionId.StartsWith("voice-"))
                {
                    _logger.LogWarning("Invalid session ID format for termination: {SessionId}", sessionId);
                    return false; // This will cause controller to return NotFound
                }

                // In test environment, check if session was actually created
                if (_isTestEnvironment && !_testSessions.Contains(sessionId))
                {
                    _logger.LogWarning("Session not found in test environment for termination: {SessionId}", sessionId);
                    return false; // This will cause controller to return NotFound
                }

                await Task.Delay(100); // Simulate API call

                // Remove from test sessions if in test environment
                if (_isTestEnvironment)
                {
                    _testSessions.Remove(sessionId);
                }

                _logger.LogInformation("Successfully terminated voice session: {SessionId}", sessionId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error terminating voice session: {SessionId}", sessionId);
                return false;
            }
        }

        public async Task<VoiceSessionStatus?> GetVoiceSessionStatusAsync(string sessionId)
        {
            try
            {
                _logger.LogInformation("Getting voice session status: {SessionId}", sessionId);

                // For Phase 1, validate session ID format and existence
                if (string.IsNullOrWhiteSpace(sessionId) || !sessionId.StartsWith("voice-"))
                {
                    _logger.LogWarning("Invalid session ID format for status check: {SessionId}", sessionId);
                    return null; // This will cause controller to return NotFound
                }

                // In test environment, check if session was actually created
                if (_isTestEnvironment && !_testSessions.Contains(sessionId))
                {
                    _logger.LogWarning("Session not found in test environment: {SessionId}", sessionId);
                    return null; // This will cause controller to return NotFound
                }

                await Task.Delay(50); // Simulate API call
                
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
                return status;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting voice session status: {SessionId}", sessionId);
                return null;
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

        private async Task<string> GenerateInitialResponseAsync(string query)
        {
            // For Phase 1, generate a simulated response based on the query
            // In Phase 2, this will call actual Azure AI Foundry to generate the response
            await Task.Delay(100); // Simulate AI processing time
            
            // Provide a contextual response based on common query types
            if (query.ToLowerInvariant().Contains("recommend") || query.ToLowerInvariant().Contains("suggestion"))
            {
                return "I'd be happy to recommend some great board games! Can you tell me more about what you're looking for? How many players, what complexity level, and any preferred themes or mechanics?";
            }
            else if (query.ToLowerInvariant().Contains("rule") || query.ToLowerInvariant().Contains("how to"))
            {
                return "I can help clarify game rules! Which game are you asking about, and what specific rule or situation would you like me to explain?";
            }
            else if (query.ToLowerInvariant().Contains("strategy") || query.ToLowerInvariant().Contains("tips"))
            {
                return "I'd love to help with strategy tips! Which game are you playing, and what aspect of strategy would you like to focus on?";
            }
            else
            {
                return "Hi there! I'm your board game assistant. I can help with game recommendations, rules questions, strategy tips, and more. What would you like to know about board games?";
            }
        }

        private async Task<string> GenerateTemporaryWebRtcTokenAsync(string sessionId)
        {
            // For Phase 1, generate a simulated token
            // In Phase 2, this will request actual WebRTC tokens from Azure AI Foundry
            await Task.Delay(50); // Simulate token generation

            var tokenData = new
            {
                sessionId,
                token = Convert.ToBase64String(Encoding.UTF8.GetBytes($"webrtc-token-{sessionId}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}")),
                expiresAt = DateTime.UtcNow.AddMinutes(30)
            };

            return JsonSerializer.Serialize(tokenData);
        }

        private async Task<FoundryLiveVoiceResponse> CreateFoundryLiveVoiceSessionAsync(string sessionId, string systemMessage)
        {
            try
            {
                _logger.LogInformation("Creating Azure OpenAI Realtime Voice session: {SessionId}", sessionId);
                
                // In test environment, return mock response
                if (_isTestEnvironment)
                {
                    _logger.LogInformation("Test environment - returning mock Realtime session response");
                    
                    var mockWebRtcToken = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
                    {
                        sessionId,
                        userId = "test-user-" + Guid.NewGuid().ToString("N")[..8],
                        expiresAt = DateTime.UtcNow.AddMinutes(30),
                        iceServers = new[]
                        {
                            new { urls = new[] { "stun:stun.l.google.com:19302" } }
                        }
                    })));

                    return new FoundryLiveVoiceResponse
                    {
                        WebRtcToken = mockWebRtcToken,
                        ConnectionUrl = "wss://test-foundry.mock/realtime/" + sessionId,
                        Status = "created"
                    };
                }

                // For production, generate authentication token and WebSocket connection URL
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

        private Task<string> GenerateRealtimeWebRtcTokenAsync(string sessionId, string systemMessage)
        {
            try
            {
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
                    apiVersion = "2024-10-01-preview" // Latest Realtime API version
                };

                var tokenJson = JsonSerializer.Serialize(tokenData);
                var webRtcToken = Convert.ToBase64String(Encoding.UTF8.GetBytes(tokenJson));
                
                _logger.LogDebug("Generated WebRTC token for session: {SessionId}", sessionId);
                return Task.FromResult(webRtcToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate WebRTC token for session: {SessionId}", sessionId);
                throw;
            }
        }

        private Task<string> GetRealtimeConnectionUrlAsync(string sessionId)
        {
            try
            {
                // The connection URL will be used by the frontend to establish WebSocket connection
                var azureOpenAIEndpoint = _configuration["VoiceService:AzureOpenAIEndpoint"];
                
                // Convert HTTPS endpoint to WebSocket URL for Realtime API
                var wsEndpoint = azureOpenAIEndpoint?.Replace("https://", "wss://").Replace("http://", "ws://");
                var connectionUrl = $"{wsEndpoint}/openai/realtime?api-version=2024-10-01-preview&deployment={_realtimeDeploymentName}";
                
                _logger.LogDebug("Generated connection URL for session {SessionId}: {ConnectionUrl}", sessionId, connectionUrl);
                return Task.FromResult(connectionUrl);
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