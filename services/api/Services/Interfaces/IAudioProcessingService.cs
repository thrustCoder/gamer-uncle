using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces;

/// <summary>
/// Service for processing audio through the complete voice pipeline (STT → AI → TTS)
/// </summary>
public interface IAudioProcessingService
{
    /// <summary>
    /// Process audio from user through the complete pipeline:
    /// 1. Convert audio to text (STT)
    /// 2. Get AI response from agent
    /// 3. Convert AI response to speech (TTS)
    /// </summary>
    /// <param name="audioBase64">Base64-encoded audio data from user</param>
    /// <param name="format">Audio format (Wav or Pcm16)</param>
    /// <param name="conversationId">Optional conversation ID to link with existing text conversation</param>
    /// <param name="gameContext">Optional game context to prepend to the query (from GameSetup screen)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Complete audio processing result with transcription, AI response text, and TTS audio</returns>
    Task<AudioProcessingResult> ProcessAudioAsync(
        string audioBase64,
        AudioFormat format,
        string? conversationId = null,
        string? gameContext = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of audio processing pipeline
/// </summary>
public class AudioProcessingResult
{
    /// <summary>
    /// Transcribed text from user's audio (STT result)
    /// </summary>
    public string TranscribedText { get; set; } = string.Empty;

    /// <summary>
    /// AI-generated response text
    /// </summary>
    public string ResponseText { get; set; } = string.Empty;

    /// <summary>
    /// TTS audio data as byte array (AI's spoken response)
    /// </summary>
    public byte[] ResponseAudio { get; set; } = Array.Empty<byte>();

    /// <summary>
    /// Conversation ID linking this interaction to text conversation
    /// </summary>
    public string ConversationId { get; set; } = string.Empty;
}
