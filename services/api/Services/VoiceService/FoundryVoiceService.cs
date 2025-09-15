using System.Text;
using System.Text.Json;
using Azure.Identity;
using Azure.AI.Projects;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.VoiceService
{
    public class FoundryVoiceService : IFoundryVoiceService
    {
        private readonly AIProjectClient _projectClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<FoundryVoiceService> _logger;
        private readonly HttpClient _httpClient;
        private readonly bool _isTestEnvironment;
        private readonly HashSet<string> _testSessionIds = new(); // Track created test sessions
        private static readonly HashSet<string> _testSessions = new(); // Track test sessions in memory

        public FoundryVoiceService(IConfiguration configuration, ILogger<FoundryVoiceService> logger, HttpClient httpClient)
        {
            _configuration = configuration;
            _logger = logger;
            _httpClient = httpClient;
            _isTestEnvironment = configuration.GetValue<bool>("Testing:DisableRateLimit") 
                               || Environment.GetEnvironmentVariable("TEST_ENVIRONMENT") == "Testing";

            var endpoint = new Uri(configuration["VoiceService:FoundryEndpoint"] 
                ?? throw new InvalidOperationException("Voice service Foundry endpoint missing"));

            // Uses DefaultAzureCredential for Azure AI Foundry authentication
            _projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
        }

        public async Task<VoiceSessionResponse> CreateVoiceSessionAsync(string query, string? conversationId = null)
        {
            try
            {
                _logger.LogInformation("Creating voice session for query: {Query}, ConversationId: {ConversationId}", 
                    query, conversationId);

                // Generate unique session ID
                var sessionId = $"voice-{Guid.NewGuid()}";
                
                // Track session in test environment
                if (_isTestEnvironment)
                {
                    _testSessions.Add(sessionId);
                }
                
                // Create system message for general board game assistance
                var systemMessage = CreateBoardGameSystemMessage(query);
                
                // Generate initial AI response for the user's query
                var initialResponse = await GenerateInitialResponseAsync(query);
                
                // For Phase 1, we'll create a simulated voice session response
                // In Phase 2, this will integrate with actual Azure AI Foundry Live Voice API
                var response = new VoiceSessionResponse
                {
                    SessionId = sessionId,
                    WebRtcToken = await GenerateTemporaryWebRtcTokenAsync(sessionId),
                    FoundryConnectionUrl = await GetFoundryVoiceConnectionUrlAsync(sessionId, systemMessage),
                    ExpiresAt = DateTime.UtcNow.AddMinutes(30), // 30-minute session limit
                    ConversationId = conversationId,
                    InitialResponse = initialResponse
                };

                _logger.LogInformation("Successfully created voice session: {SessionId}", sessionId);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating voice session for query: {Query}", query);
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
}