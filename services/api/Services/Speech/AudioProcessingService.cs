using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Models;
using GamerUncle.Shared.Models;
using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace GamerUncle.Api.Services.Speech;

/// <summary>
/// Service that orchestrates the complete audio processing pipeline: STT → AI Agent → TTS
/// </summary>
public class AudioProcessingService : IAudioProcessingService
{
    private readonly IAzureSpeechService _speechService;
    private readonly IAgentServiceClient _agentService;
    private readonly ILogger<AudioProcessingService> _logger;
    
    // Custom metrics for Application Insights
    private static readonly Meter _meter = new("GamerUncle.VoiceProcessing", "1.0");
    private static readonly Counter<long> _audioRequestCounter = _meter.CreateCounter<long>(
        "voice.audio_requests_total",
        description: "Total number of audio processing requests");
    private static readonly Counter<long> _audioFailureCounter = _meter.CreateCounter<long>(
        "voice.audio_failures_total",
        description: "Total number of audio processing failures");
    private static readonly Histogram<double> _sttDurationHistogram = _meter.CreateHistogram<double>(
        "voice.stt_duration_ms",
        unit: "ms",
        description: "Speech-to-Text processing duration");
    private static readonly Histogram<double> _agentDurationHistogram = _meter.CreateHistogram<double>(
        "voice.agent_duration_ms",
        unit: "ms",
        description: "AI Agent processing duration");
    private static readonly Histogram<double> _ttsDurationHistogram = _meter.CreateHistogram<double>(
        "voice.tts_duration_ms",
        unit: "ms",
        description: "Text-to-Speech processing duration");
    private static readonly Histogram<double> _totalDurationHistogram = _meter.CreateHistogram<double>(
        "voice.total_duration_ms",
        unit: "ms",
        description: "Total audio processing pipeline duration");
    private static readonly Histogram<long> _audioSizeHistogram = _meter.CreateHistogram<long>(
        "voice.audio_size_bytes",
        unit: "bytes",
        description: "Size of TTS audio responses");

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
        string? gameContext = null,
        CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        _logger.LogInformation("Starting audio processing pipeline. ConversationId: {ConversationId}, Format: {Format}, HasGameContext: {HasGameContext}", 
            conversationId, format, !string.IsNullOrEmpty(gameContext));

        // Increment request counter
        _audioRequestCounter.Add(1, new KeyValuePair<string, object?>("format", format.ToString()));

        try
        {
            // Step 1: Speech-to-Text (STT)
            var sttStartTime = DateTime.UtcNow;
            var transcription = await _speechService.SpeechToTextAsync(audioBase64, format, cancellationToken);
            var sttDuration = (DateTime.UtcNow - sttStartTime).TotalMilliseconds;
            
            // Record STT duration metric
            _sttDurationHistogram.Record(sttDuration, new KeyValuePair<string, object?>("format", format.ToString()));
            
            _logger.LogInformation("STT completed in {Duration}ms. Transcription: {Transcription}", 
                sttDuration, transcription);

            if (string.IsNullOrWhiteSpace(transcription))
            {
                throw new InvalidOperationException("Speech recognition returned empty transcription");
            }

            // Prepend game context to transcription if provided (from GameSetup screen)
            var queryForAgent = transcription;
            if (!string.IsNullOrWhiteSpace(gameContext))
            {
                queryForAgent = $"{gameContext} {transcription}";
                _logger.LogInformation("Prepended game context to query. Original: {Original}, WithContext: {WithContext}", 
                    transcription, queryForAgent);
            }

            // Step 2: Get AI response from agent
            var agentStartTime = DateTime.UtcNow;
            var agentResponse = await _agentService.GetRecommendationsAsync(
                queryForAgent, 
                conversationId);
            var agentDuration = (DateTime.UtcNow - agentStartTime).TotalMilliseconds;
            
            // Record agent duration metric
            _agentDurationHistogram.Record(agentDuration);
            
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
            
            // Record TTS duration and audio size metrics
            _ttsDurationHistogram.Record(ttsDuration);
            _audioSizeHistogram.Record(audioBytes.Length);
            
            _logger.LogInformation("TTS completed in {Duration}ms. Audio size: {Size} bytes", 
                ttsDuration, audioBytes.Length);

            // Calculate total processing time and record metric
            var totalDuration = (DateTime.UtcNow - startTime).TotalMilliseconds;
            _totalDurationHistogram.Record(totalDuration, new KeyValuePair<string, object?>("format", format.ToString()));
            
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
            
            // Record failure metrics
            _audioFailureCounter.Add(1, 
                new KeyValuePair<string, object?>("format", format.ToString()),
                new KeyValuePair<string, object?>("error_type", ex.GetType().Name));
            
            _logger.LogError(ex, "Audio processing pipeline failed after {Duration}ms. ConversationId: {ConversationId}",
                duration, conversationId);
            throw;
        }
    }
}
