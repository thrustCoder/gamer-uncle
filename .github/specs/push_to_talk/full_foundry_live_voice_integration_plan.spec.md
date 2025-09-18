# Full Foundry Live Voice Integration Plan (Phase 2)

## Overview
This document outlines the complete integration of Azure AI Foundry Live Voice capabilities with the existing Gamer Uncle architecture, preserving the current Cosmos DB RAG pipeline while adding full bidirectional voice conversation support.

---

## 🎯 Architecture Goals

### Current State (Phase 1)
```
User Voice → Manual STT → Text Query → Cosmos RAG → Azure Agent → Text Response → Manual TTS
```

### Target State (Phase 2)  
```
User Voice → Foundry Live Voice → [Cosmos RAG Context] → Agent Processing → Foundry TTS → User Audio
```

### Key Principles
- **Preserve existing RAG pipeline**: Cosmos DB vector search remains the intelligence layer
- **Eliminate manual STT/TTS**: Foundry handles all audio processing
- **Enhance context injection**: RAG results feed directly into Foundry system messages
- **Maintain performance**: <50ms Cosmos latency for context preloading

---

## 🛠️ Backend Implementation

### 1. Enhanced Shared Models

#### Create: `services/shared/models/FoundryVoiceModels.cs`
```csharp
namespace GamerUncle.Shared.Models;

public class FoundryVoiceSessionRequest
{
    public string? ConversationId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? GameId { get; set; } // For RAG context preloading
    public string? UserPreferences { get; set; } // For personalized context
}

public class FoundryVoiceSessionResponse
{
    public string SessionId { get; set; } = string.Empty;
    public string FoundryConnectionUrl { get; set; } = string.Empty;
    public string WebRtcToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string? ConversationId { get; set; }
    public string? InitialSystemMessage { get; set; } // RAG-enhanced context
}

public class GameContext
{
    public string GameId { get; set; } = string.Empty;
    public string GameName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Mechanics { get; set; } = new();
    public List<string> Categories { get; set; } = new();
    public Dictionary<string, object> Metadata { get; set; } = new();
    public List<SimilarGame> SimilarGames { get; set; } = new();
    public string RulesContext { get; set; } = string.Empty;
    public List<string> StrategyTips { get; set; } = new();
}

public class SimilarGame
{
    public string GameId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double SimilarityScore { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class FoundrySystemContext
{
    public GameContext? PrimaryGame { get; set; }
    public List<GameContext> RecentGames { get; set; } = new();
    public Dictionary<string, object> UserProfile { get; set; } = new();
    public string ConversationContext { get; set; } = string.Empty;
}
```

### 2. Enhanced Game Data Service

#### Update: `services/api/Services/IGameDataService.cs`
```csharp
public interface IGameDataService
{
    // Existing methods...
    Task<List<GameDocument>> GetSimilarGamesAsync(string gameId);
    
    // New methods for Foundry integration
    Task<GameContext> GetGameContextAsync(string gameId);
    Task<FoundrySystemContext> GetFoundrySystemContextAsync(string? gameId, string userId);
    Task<string> GetConversationRelevantContextAsync(string query, List<string> recentGameIds);
    Task<List<GameContext>> GetUserRecentGamesContextAsync(string userId, int limit = 5);
}
```

#### Update: `services/api/Services/GameDataService.cs`
```csharp
public class GameDataService : IGameDataService
{
    private readonly CosmosClient _cosmosClient;
    private readonly Container _gamesContainer;
    private readonly ILogger<GameDataService> _logger;

    // Existing constructor and methods...

    public async Task<GameContext> GetGameContextAsync(string gameId)
    {
        try
        {
            _logger.LogInformation("Fetching game context for {GameId}", gameId);
            
            // Get primary game data
            var gameDoc = await _gamesContainer.ReadItemAsync<GameDocument>(gameId, new PartitionKey(gameId));
            
            // Get similar games using existing vector search
            var similarGames = await GetSimilarGamesAsync(gameId);
            
            return new GameContext
            {
                GameId = gameDoc.Resource.Id,
                GameName = gameDoc.Resource.Name,
                Description = gameDoc.Resource.Description,
                Mechanics = gameDoc.Resource.Mechanics,
                Categories = gameDoc.Resource.Categories,
                Metadata = new Dictionary<string, object>
                {
                    ["PlayerCount"] = $"{gameDoc.Resource.MinPlayers}-{gameDoc.Resource.MaxPlayers}",
                    ["PlayTime"] = $"{gameDoc.Resource.MinPlayTime}-{gameDoc.Resource.MaxPlayTime} minutes",
                    ["Complexity"] = gameDoc.Resource.AverageWeight,
                    ["Rating"] = gameDoc.Resource.AverageRating,
                    ["YearPublished"] = gameDoc.Resource.YearPublished
                },
                SimilarGames = similarGames.Take(5).Select(g => new SimilarGame
                {
                    GameId = g.Id,
                    Name = g.Name,
                    SimilarityScore = 0.85, // From vector search
                    Reason = $"Similar mechanics: {string.Join(", ", g.Mechanics.Intersect(gameDoc.Resource.Mechanics))}"
                }).ToList(),
                RulesContext = await GetGameRulesContextAsync(gameId),
                StrategyTips = await GetGameStrategyTipsAsync(gameId)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get game context for {GameId}", gameId);
            throw;
        }
    }

    public async Task<FoundrySystemContext> GetFoundrySystemContextAsync(string? gameId, string userId)
    {
        var context = new FoundrySystemContext
        {
            UserProfile = await GetUserProfileAsync(userId),
            RecentGames = await GetUserRecentGamesContextAsync(userId),
            ConversationContext = "Board game recommendation and strategy assistance"
        };

        if (!string.IsNullOrEmpty(gameId))
        {
            context.PrimaryGame = await GetGameContextAsync(gameId);
        }

        return context;
    }

    public async Task<string> GetConversationRelevantContextAsync(string query, List<string> recentGameIds)
    {
        // Use existing vector search to find relevant games based on query
        var relevantGames = await QueryRelevantGamesAsync(query);
        
        // Combine with recent games context
        var recentGamesContext = await Task.WhenAll(
            recentGameIds.Take(3).Select(id => GetGameContextAsync(id))
        );

        return FormatContextForFoundry(relevantGames, recentGamesContext);
    }

    private async Task<string> GetGameRulesContextAsync(string gameId)
    {
        // Extract rules summary from game document or separate rules collection
        // Implementation depends on your current data structure
        return "Game rules context..."; // Placeholder
    }

    private async Task<List<string>> GetGameStrategyTipsAsync(string gameId)
    {
        // Extract strategy tips from game document or community data
        // Implementation depends on your current data structure
        return new List<string> { "Strategy tip 1", "Strategy tip 2" }; // Placeholder
    }

    private string FormatContextForFoundry(List<GameDocument> relevantGames, GameContext[] recentGames)
    {
        // Format game data for Foundry system message
        var contextBuilder = new StringBuilder();
        
        if (recentGames.Any())
        {
            contextBuilder.AppendLine("Recent games discussed:");
            foreach (var game in recentGames)
            {
                contextBuilder.AppendLine($"- {game.GameName}: {game.Description}");
            }
        }

        if (relevantGames.Any())
        {
            contextBuilder.AppendLine("\nRelevant games from database:");
            foreach (var game in relevantGames.Take(5))
            {
                contextBuilder.AppendLine($"- {game.Name}: {game.Description}");
            }
        }

        return contextBuilder.ToString();
    }
}
```

### 3. Foundry Voice Service

#### Create: `services/api/Services/IFoundryVoiceService.cs`
```csharp
public interface IFoundryVoiceService
{
    Task<FoundryVoiceSessionResponse> CreateVoiceSessionAsync(FoundryVoiceSessionRequest request);
    Task<bool> UpdateSessionContextAsync(string sessionId, string additionalContext);
    Task<bool> EndVoiceSessionAsync(string sessionId);
    Task<string> GetSessionStatusAsync(string sessionId);
}
```

#### Create: `services/api/Services/FoundryVoiceService.cs`
```csharp
public class FoundryVoiceService : IFoundryVoiceService
{
    private readonly HttpClient _httpClient;
    private readonly IGameDataService _gameDataService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FoundryVoiceService> _logger;

    public FoundryVoiceService(
        HttpClient httpClient,
        IGameDataService gameDataService,
        IConfiguration configuration,
        ILogger<FoundryVoiceService> logger)
    {
        _httpClient = httpClient;
        _gameDataService = gameDataService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<FoundryVoiceSessionResponse> CreateVoiceSessionAsync(FoundryVoiceSessionRequest request)
    {
        try
        {
            _logger.LogInformation("Creating Foundry voice session for user {UserId}", request.UserId);

            // 1. Get RAG context using existing pipeline
            var systemContext = await _gameDataService.GetFoundrySystemContextAsync(request.GameId, request.UserId);
            
            // 2. Format system message with RAG data
            var systemMessage = FormatSystemMessage(systemContext);
            
            // 3. Create Foundry Live Voice session
            var foundryRequest = new
            {
                SystemMessage = systemMessage,
                VoiceSettings = new
                {
                    Voice = "alloy", // Or configurable voice
                    Speed = 1.0,
                    Pitch = 1.0
                },
                ConversationSettings = new
                {
                    MaxTurnDuration = 30, // seconds
                    SilenceTimeout = 3000, // ms
                    EnableInterruption = true
                }
            };

            var foundryEndpoint = _configuration["FoundryVoice:Endpoint"];
            var response = await _httpClient.PostAsJsonAsync($"{foundryEndpoint}/voice/sessions", foundryRequest);
            response.EnsureSuccessStatusCode();

            var foundryResponse = await response.Content.ReadFromJsonAsync<FoundryVoiceSessionResponse>();
            
            _logger.LogInformation("Created Foundry voice session {SessionId}", foundryResponse?.SessionId);

            return foundryResponse ?? throw new InvalidOperationException("Failed to create voice session");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Foundry voice session for user {UserId}", request.UserId);
            throw;
        }
    }

    public async Task<bool> UpdateSessionContextAsync(string sessionId, string additionalContext)
    {
        try
        {
            var updateRequest = new { Context = additionalContext };
            var foundryEndpoint = _configuration["FoundryVoice:Endpoint"];
            var response = await _httpClient.PutAsJsonAsync($"{foundryEndpoint}/voice/sessions/{sessionId}/context", updateRequest);
            
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update session context for {SessionId}", sessionId);
            return false;
        }
    }

    public async Task<bool> EndVoiceSessionAsync(string sessionId)
    {
        try
        {
            var foundryEndpoint = _configuration["FoundryVoice:Endpoint"];
            var response = await _httpClient.DeleteAsync($"{foundryEndpoint}/voice/sessions/{sessionId}");
            
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to end voice session {SessionId}", sessionId);
            return false;
        }
    }

    public async Task<string> GetSessionStatusAsync(string sessionId)
    {
        try
        {
            var foundryEndpoint = _configuration["FoundryVoice:Endpoint"];
            var response = await _httpClient.GetAsync($"{foundryEndpoint}/voice/sessions/{sessionId}/status");
            
            if (response.IsSuccessStatusCode)
            {
                var status = await response.Content.ReadAsStringAsync();
                return status;
            }
            
            return "unknown";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get session status for {SessionId}", sessionId);
            return "error";
        }
    }

    private string FormatSystemMessage(FoundrySystemContext context)
    {
        var messageBuilder = new StringBuilder();
        
        messageBuilder.AppendLine("You are an expert board game assistant with access to comprehensive game data.");
        messageBuilder.AppendLine("Your responses should be conversational, helpful, and enthusiastic about board games.");
        messageBuilder.AppendLine();

        if (context.PrimaryGame != null)
        {
            var game = context.PrimaryGame;
            messageBuilder.AppendLine($"CURRENT GAME FOCUS: {game.GameName}");
            messageBuilder.AppendLine($"Description: {game.Description}");
            messageBuilder.AppendLine($"Mechanics: {string.Join(", ", game.Mechanics)}");
            messageBuilder.AppendLine($"Player Count: {game.Metadata.GetValueOrDefault("PlayerCount", "Unknown")}");
            messageBuilder.AppendLine($"Play Time: {game.Metadata.GetValueOrDefault("PlayTime", "Unknown")}");
            messageBuilder.AppendLine();

            if (game.SimilarGames.Any())
            {
                messageBuilder.AppendLine("SIMILAR GAMES:");
                foreach (var similar in game.SimilarGames)
                {
                    messageBuilder.AppendLine($"- {similar.Name}: {similar.Reason}");
                }
                messageBuilder.AppendLine();
            }

            if (game.StrategyTips.Any())
            {
                messageBuilder.AppendLine("STRATEGY INSIGHTS:");
                foreach (var tip in game.StrategyTips)
                {
                    messageBuilder.AppendLine($"- {tip}");
                }
                messageBuilder.AppendLine();
            }
        }

        if (context.RecentGames.Any())
        {
            messageBuilder.AppendLine("RECENT CONVERSATION CONTEXT:");
            foreach (var recentGame in context.RecentGames)
            {
                messageBuilder.AppendLine($"- {recentGame.GameName}: {recentGame.Description}");
            }
            messageBuilder.AppendLine();
        }

        messageBuilder.AppendLine("Guidelines:");
        messageBuilder.AppendLine("- Provide specific, actionable advice");
        messageBuilder.AppendLine("- Reference the game data provided");
        messageBuilder.AppendLine("- Ask follow-up questions to understand user needs");
        messageBuilder.AppendLine("- Keep responses conversational and engaging");
        messageBuilder.AppendLine("- Suggest alternatives when appropriate");

        return messageBuilder.ToString();
    }
}
```

### 4. Enhanced Voice Controller

#### Update: `services/api/Controllers/VoiceController.cs`
```csharp
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("DefaultPolicy")]
public class VoiceController : ControllerBase
{
    private readonly IFoundryVoiceService _foundryVoiceService;
    private readonly ILogger<VoiceController> _logger;

    public VoiceController(
        IFoundryVoiceService foundryVoiceService,
        ILogger<VoiceController> logger)
    {
        _foundryVoiceService = foundryVoiceService;
        _logger = logger;
    }

    [HttpPost("sessions")]
    public async Task<ActionResult<FoundryVoiceSessionResponse>> CreateVoiceSession(
        [FromBody] FoundryVoiceSessionRequest request)
    {
        try
        {
            _logger.LogInformation("Creating voice session for user {UserId} with game {GameId}", 
                request.UserId, request.GameId);

            var response = await _foundryVoiceService.CreateVoiceSessionAsync(request);
            
            _logger.LogInformation("Voice session created successfully: {SessionId}", response.SessionId);
            
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create voice session for user {UserId}", request.UserId);
            return StatusCode(500, new { error = "Failed to create voice session" });
        }
    }

    [HttpPut("sessions/{sessionId}/context")]
    public async Task<ActionResult> UpdateSessionContext(
        string sessionId,
        [FromBody] UpdateContextRequest request)
    {
        try
        {
            var success = await _foundryVoiceService.UpdateSessionContextAsync(sessionId, request.Context);
            
            if (success)
            {
                return Ok(new { message = "Context updated successfully" });
            }
            
            return BadRequest(new { error = "Failed to update context" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update context for session {SessionId}", sessionId);
            return StatusCode(500, new { error = "Failed to update session context" });
        }
    }

    [HttpDelete("sessions/{sessionId}")]
    public async Task<ActionResult> EndVoiceSession(string sessionId)
    {
        try
        {
            var success = await _foundryVoiceService.EndVoiceSessionAsync(sessionId);
            
            if (success)
            {
                return Ok(new { message = "Session ended successfully" });
            }
            
            return BadRequest(new { error = "Failed to end session" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to end session {SessionId}", sessionId);
            return StatusCode(500, new { error = "Failed to end session" });
        }
    }

    [HttpGet("sessions/{sessionId}/status")]
    public async Task<ActionResult<string>> GetSessionStatus(string sessionId)
    {
        try
        {
            var status = await _foundryVoiceService.GetSessionStatusAsync(sessionId);
            return Ok(new { sessionId, status });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get status for session {SessionId}", sessionId);
            return StatusCode(500, new { error = "Failed to get session status" });
        }
    }
}

public class UpdateContextRequest
{
    public string Context { get; set; } = string.Empty;
}
```

### 5. Configuration Updates

#### Update: `services/api/appsettings.json`
```json
{
  "FoundryVoice": {
    "Endpoint": "https://your-foundry-endpoint.azure.com",
    "ApiKey": "your-foundry-api-key",
    "DefaultVoice": "alloy",
    "MaxSessionDuration": 1800,
    "SilenceTimeout": 3000
  },
  "GameData": {
    "MaxContextGames": 5,
    "ContextPreloadEnabled": true,
    "VectorSearchThreshold": 0.8
  }
}
```

#### Update: `services/api/Program.cs`
```csharp
// Add Foundry Voice Service
builder.Services.AddHttpClient<IFoundryVoiceService, FoundryVoiceService>(client =>
{
    var foundryEndpoint = builder.Configuration["FoundryVoice:Endpoint"];
    var apiKey = builder.Configuration["FoundryVoice:ApiKey"];
    
    client.BaseAddress = new Uri(foundryEndpoint);
    client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    client.DefaultRequestHeaders.Add("User-Agent", "GamerUncle/1.0");
});

// Register enhanced services
builder.Services.AddScoped<IFoundryVoiceService, FoundryVoiceService>();
builder.Services.AddScoped<IGameDataService, GameDataService>();
```

---

## 📱 Frontend Implementation

### 1. Enhanced Voice Service

#### Update: `apps/mobile/services/foundryVoiceService.ts`
```typescript
interface FoundryVoiceSession {
  sessionId: string;
  foundryConnectionUrl: string;
  webRtcToken: string;
  expiresAt: string;
  conversationId?: string;
}

interface FoundryVoiceConfig {
  gameId?: string;
  userId: string;
  conversationId?: string;
}

export class FoundryVoiceService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentSession: FoundryVoiceSession | null = null;
  private websocket: WebSocket | null = null;

  constructor(
    private apiService: ApiService,
    private onRemoteAudio: (stream: MediaStream) => void,
    private onConnectionStateChange: (state: string) => void
  ) {}

  async startVoiceSession(config: FoundryVoiceConfig): Promise<boolean> {
    try {
      console.log('🎤 [FOUNDRY] Starting voice session with config:', config);

      // 1. Create voice session (includes RAG context preloading)
      this.currentSession = await this.createVoiceSession(config);
      
      // 2. Set up WebRTC connection to Foundry
      await this.setupWebRTCConnection();
      
      // 3. Get user microphone access
      this.localStream = await this.getUserMedia();
      
      // 4. Add audio track to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getAudioTracks().forEach(track => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // 5. Create offer and connect to Foundry
      await this.connectToFoundry();

      console.log('🟢 [FOUNDRY] Voice session started successfully');
      return true;

    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to start voice session:', error);
      return false;
    }
  }

  private async createVoiceSession(config: FoundryVoiceConfig): Promise<FoundryVoiceSession> {
    const request = {
      userId: config.userId,
      gameId: config.gameId,
      conversationId: config.conversationId
    };

    const response = await this.apiService.post<FoundryVoiceSession>('/voice/sessions', request);
    
    if (!response.sessionId) {
      throw new Error('Failed to create voice session');
    }

    return response;
  }

  private async setupWebRTCConnection(): Promise<void> {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Handle incoming audio stream
    this.peerConnection.ontrack = (event) => {
      console.log('🎵 [FOUNDRY] Received remote audio track');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteAudio(this.remoteStream);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log(`🔗 [FOUNDRY] Connection state: ${state}`);
      this.onConnectionStateChange(state);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          sessionId: this.currentSession?.sessionId
        }));
      }
    };
  }

  private async getUserMedia(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to get user media:', error);
      throw new Error('Microphone access denied');
    }
  }

  private async connectToFoundry(): Promise<void> {
    if (!this.currentSession || !this.peerConnection) {
      throw new Error('Session or peer connection not initialized');
    }

    // Create WebSocket connection to Foundry
    this.websocket = new WebSocket(this.currentSession.foundryConnectionUrl);
    
    this.websocket.onopen = async () => {
      console.log('🔗 [FOUNDRY] WebSocket connected');
      
      // Send authentication
      this.websocket!.send(JSON.stringify({
        type: 'auth',
        token: this.currentSession!.webRtcToken,
        sessionId: this.currentSession!.sessionId
      }));

      // Create and send offer
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true
      });
      
      await this.peerConnection!.setLocalDescription(offer);
      
      this.websocket!.send(JSON.stringify({
        type: 'offer',
        sdp: offer,
        sessionId: this.currentSession!.sessionId
      }));
    };

    this.websocket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      await this.handleFoundryMessage(message);
    };

    this.websocket.onerror = (error) => {
      console.error('🔴 [FOUNDRY] WebSocket error:', error);
    };

    this.websocket.onclose = () => {
      console.log('🔗 [FOUNDRY] WebSocket closed');
    };
  }

  private async handleFoundryMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'answer':
        if (this.peerConnection && message.sdp) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
        }
        break;

      case 'ice-candidate':
        if (this.peerConnection && message.candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;

      case 'session-ready':
        console.log('🟢 [FOUNDRY] Session ready for voice interaction');
        break;

      case 'error':
        console.error('🔴 [FOUNDRY] Session error:', message.error);
        break;

      default:
        console.log('🔍 [FOUNDRY] Unknown message type:', message.type);
    }
  }

  async updateContext(gameId: string): Promise<boolean> {
    if (!this.currentSession) {
      console.warn('🟡 [FOUNDRY] No active session to update context');
      return false;
    }

    try {
      const response = await this.apiService.put(
        `/voice/sessions/${this.currentSession.sessionId}/context`,
        { context: `User is now discussing game: ${gameId}` }
      );

      return response.status === 200;
    } catch (error) {
      console.error('🔴 [FOUNDRY] Failed to update context:', error);
      return false;
    }
  }

  async endVoiceSession(): Promise<void> {
    try {
      // Close WebRTC connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Close WebSocket
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // End session on backend
      if (this.currentSession) {
        await this.apiService.delete(`/voice/sessions/${this.currentSession.sessionId}`);
        this.currentSession = null;
      }

      console.log('🟢 [FOUNDRY] Voice session ended successfully');
    } catch (error) {
      console.error('🔴 [FOUNDRY] Error ending voice session:', error);
    }
  }

  isActive(): boolean {
    return this.currentSession !== null && 
           this.peerConnection?.connectionState === 'connected';
  }

  getSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }
}
```

### 2. Updated Voice Chat Component

#### Update: `apps/mobile/components/VoiceChatComponent.tsx`
```typescript
import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FoundryVoiceService } from '../services/foundryVoiceService';
import { ApiService } from '../services/apiService';

interface VoiceChatComponentProps {
  gameId?: string;
  userId: string;
  conversationId?: string;
  onVoiceSessionChange?: (isActive: boolean) => void;
}

export const VoiceChatComponent: React.FC<VoiceChatComponentProps> = ({
  gameId,
  userId,
  conversationId,
  onVoiceSessionChange
}) => {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const foundryVoiceService = useRef<FoundryVoiceService | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize Foundry Voice Service
    foundryVoiceService.current = new FoundryVoiceService(
      new ApiService(),
      handleRemoteAudio,
      handleConnectionStateChange
    );

    return () => {
      // Cleanup on unmount
      if (foundryVoiceService.current?.isActive()) {
        foundryVoiceService.current.endVoiceSession();
      }
    };
  }, []);

  const handleRemoteAudio = (stream: MediaStream) => {
    console.log('🎵 [VOICE] Received remote audio stream');
    
    // Play the audio stream (agent's voice response)
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(error => {
        console.error('🔴 [VOICE] Failed to play remote audio:', error);
      });
    }
  };

  const handleConnectionStateChange = (state: string) => {
    setConnectionState(state);
    
    if (state === 'connected') {
      setIsConnecting(false);
      setIsVoiceActive(true);
      onVoiceSessionChange?.(true);
    } else if (state === 'disconnected' || state === 'failed') {
      setIsConnecting(false);
      setIsVoiceActive(false);
      onVoiceSessionChange?.(false);
    }
  };

  const startVoiceSession = async () => {
    if (!foundryVoiceService.current || isVoiceActive || isConnecting) {
      return;
    }

    setIsConnecting(true);

    try {
      const success = await foundryVoiceService.current.startVoiceSession({
        gameId,
        userId,
        conversationId
      });

      if (!success) {
        setIsConnecting(false);
        console.error('🔴 [VOICE] Failed to start voice session');
      }
    } catch (error) {
      setIsConnecting(false);
      console.error('🔴 [VOICE] Error starting voice session:', error);
    }
  };

  const endVoiceSession = async () => {
    if (!foundryVoiceService.current || !isVoiceActive) {
      return;
    }

    setIsConnecting(true);

    try {
      await foundryVoiceService.current.endVoiceSession();
      setIsVoiceActive(false);
      setConnectionState('disconnected');
      onVoiceSessionChange?.(false);
    } catch (error) {
      console.error('🔴 [VOICE] Error ending voice session:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const updateGameContext = async (newGameId: string) => {
    if (foundryVoiceService.current?.isActive()) {
      const success = await foundryVoiceService.current.updateContext(newGameId);
      console.log(success ? '🟢 [VOICE] Context updated' : '🟡 [VOICE] Context update failed');
    }
  };

  // Expose updateGameContext for parent components
  useEffect(() => {
    if (gameId && isVoiceActive) {
      updateGameContext(gameId);
    }
  }, [gameId, isVoiceActive]);

  return (
    <View style={styles.container}>
      {/* Hidden audio element for playing agent responses */}
      <audio
        ref={audioRef}
        autoPlay
        style={{ display: 'none' }}
      />
      
      <TouchableOpacity
        style={[
          styles.voiceButton,
          isVoiceActive && styles.voiceButtonActive,
          isConnecting && styles.voiceButtonConnecting
        ]}
        onPress={isVoiceActive ? endVoiceSession : startVoiceSession}
        disabled={isConnecting}
      >
        <Text style={styles.voiceButtonText}>
          {isConnecting ? 'Connecting...' : 
           isVoiceActive ? '🎤 End Voice Chat' : '🎤 Start Voice Chat'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.statusText}>
        Status: {connectionState}
      </Text>

      {isVoiceActive && (
        <Text style={styles.instructionText}>
          🎙️ Speak naturally - the AI will respond with voice
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  voiceButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#FF3B30',
  },
  voiceButtonConnecting: {
    backgroundColor: '#FF9500',
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  instructionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
  },
});
```

### 3. Integration with Chat Screen

#### Update: `apps/mobile/screens/ChatScreen.tsx`
```typescript
// Remove existing manual STT/TTS imports and add:
import { VoiceChatComponent } from '../components/VoiceChatComponent';

// In the ChatScreen component:
const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

// Replace existing voice functionality with:
<VoiceChatComponent
  gameId={currentGameId}
  userId={userId}
  conversationId={conversationId}
  onVoiceSessionChange={setIsVoiceChatActive}
/>

// Remove manual speech recognition service calls
// The VoiceChatComponent now handles all voice interaction
```

---

## 🧪 Testing Strategy

### 1. Backend Testing

#### Unit Tests: `services/tests/api/FoundryVoiceServiceTests.cs`
```csharp
[Test]
public async Task CreateVoiceSession_WithGameId_ShouldIncludeRAGContext()
{
    // Arrange
    var request = new FoundryVoiceSessionRequest
    {
        UserId = "test-user",
        GameId = "wingspan"
    };

    // Act
    var response = await _foundryVoiceService.CreateVoiceSessionAsync(request);

    // Assert
    Assert.That(response.SessionId, Is.Not.Null);
    Assert.That(response.InitialSystemMessage, Contains.Substring("Wingspan"));
    // Verify RAG context was included
}
```

### 2. Frontend Testing

#### E2E Tests: `apps/mobile/e2e/voice-chat.spec.ts`
```typescript
test('should create voice session with game context', async ({ page }) => {
  // Navigate to chat screen with specific game
  await page.goto('/chat?gameId=wingspan');
  
  // Start voice session
  await page.click('text=Start Voice Chat');
  
  // Verify session creation
  await expect(page.locator('text=End Voice Chat')).toBeVisible();
  
  // Mock voice input and verify context
  // (Implementation depends on testing framework capabilities)
});
```

---

## 📊 Performance Targets

- **Session Creation**: <500ms (including RAG context preloading)
- **Cosmos DB Context Query**: <50ms
- **WebRTC Connection**: <2s
- **Voice-to-Voice Latency**: <800ms (Foundry's built-in optimization)
- **Context Update**: <100ms

---

## 🚀 Deployment Strategy

### Phase 2.1: Backend Implementation
1. Deploy enhanced backend services
2. Test Foundry integration in development
3. Validate RAG context injection

### Phase 2.2: Frontend Integration  
4. Deploy mobile app with new voice components
5. Test end-to-end voice conversation flow
6. Validate WebRTC connection stability

### Phase 2.3: Production Rollout
7. Enable voice features for beta users
8. Monitor performance and user feedback
9. Full production deployment

---

## ✅ Success Criteria

- [ ] Voice sessions created with full RAG context (<500ms)
- [ ] Bidirectional voice conversation working (STT + TTS via Foundry)
- [ ] Game context properly injected and referenced
- [ ] WebRTC connection stable and low-latency
- [ ] Existing text-based functionality preserved
- [ ] E2E tests passing for voice features
- [ ] Performance targets met consistently
- [ ] User can seamlessly switch between text and voice interaction

---

This implementation preserves your existing Cosmos DB RAG pipeline while adding full Foundry Live Voice capabilities, creating a rich, context-aware voice conversation experience for board game enthusiasts.