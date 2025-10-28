using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Speech;

/// <summary>
/// Service that orchestrates the complete audio processing pipeline: STT → AI Agent → TTS
/// </summary>
public class AudioProcessingService : IAudioProcessingService
{
    private readonly IAzureSpeechService _speechService;
    private readonly IAgentServiceClient _agentService;
    private readonly ILogger<AudioProcessingService> _logger;

    public AudioProcessingService(
        IAzureSpeechService speechService,
        IAgentServiceClient agentService,
        ILogger<AudioProcessingService> logger)
    {
        _speechService = speechService;
        _agentService = agentService;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<AudioProcessingResult> ProcessAudioAsync(
        string audioBase64,
        AudioFormat format,
        string? conversationId = null,
        CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        _logger.LogInformation("Starting audio processing pipeline. ConversationId: {ConversationId}, Format: {Format}", 
            conversationId, format);

        try
        {
            // Step 1: Speech-to-Text (STT)
            var sttStartTime = DateTime.UtcNow;
            var transcription = await _speechService.SpeechToTextAsync(audioBase64, format, cancellationToken);
            var sttDuration = (DateTime.UtcNow - sttStartTime).TotalMilliseconds;
            
            _logger.LogInformation("STT completed in {Duration}ms. Transcription: {Transcription}", 
                sttDuration, transcription);

            if (string.IsNullOrWhiteSpace(transcription))
            {
                throw new InvalidOperationException("Speech recognition returned empty transcription");
            }

            // Step 2: Get AI response from agent
            var agentStartTime = DateTime.UtcNow;
            var agentResponse = await _agentService.GetRecommendationsAsync(
                transcription, 
                conversationId);
            var agentDuration = (DateTime.UtcNow - agentStartTime).TotalMilliseconds;
            
            _logger.LogInformation("AI agent response received in {Duration}ms. ThreadId: {ThreadId}, Response length: {Length}", 
                agentDuration, agentResponse.ThreadId, agentResponse.ResponseText?.Length ?? 0);

            if (string.IsNullOrWhiteSpace(agentResponse.ResponseText))
            {
                throw new InvalidOperationException("AI agent returned empty response");
            }

            // Step 3: Text-to-Speech (TTS)
            var ttsStartTime = DateTime.UtcNow;
            var audioBytes = await _speechService.TextToSpeechAsync(agentResponse.ResponseText, null, cancellationToken);
            var ttsDuration = (DateTime.UtcNow - ttsStartTime).TotalMilliseconds;
            
            _logger.LogInformation("TTS completed in {Duration}ms. Audio size: {Size} bytes", 
                ttsDuration, audioBytes.Length);

            // Calculate total processing time
            var totalDuration = (DateTime.UtcNow - startTime).TotalMilliseconds;
            _logger.LogInformation("Audio processing pipeline completed in {TotalDuration}ms (STT: {STT}ms, Agent: {Agent}ms, TTS: {TTS}ms)",
                totalDuration, sttDuration, agentDuration, ttsDuration);

            return new AudioProcessingResult
            {
                TranscribedText = transcription,
                ResponseText = agentResponse.ResponseText ?? string.Empty,
                ResponseAudio = audioBytes,
                ConversationId = agentResponse.ThreadId ?? conversationId ?? string.Empty
            };
        }
        catch (Exception ex)
        {
            var duration = (DateTime.UtcNow - startTime).TotalMilliseconds;
            _logger.LogError(ex, "Audio processing pipeline failed after {Duration}ms. ConversationId: {ConversationId}",
                duration, conversationId);
            throw;
        }
    }
}
