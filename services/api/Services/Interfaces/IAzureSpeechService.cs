using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces;

/// <summary>
/// Service for Azure Speech Services integration (STT and TTS)
/// </summary>
public interface IAzureSpeechService
{
    /// <summary>
    /// Convert audio to text using Azure Speech Services (STT)
    /// </summary>
    /// <param name="audioBase64">Base64-encoded audio data</param>
    /// <param name="format">Audio format (Wav or Pcm16)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Transcribed text from the audio</returns>
    Task<string> SpeechToTextAsync(
        string audioBase64, 
        AudioFormat format, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Convert text to speech using Azure Speech Services (TTS)
    /// </summary>
    /// <param name="text">Text to convert to speech</param>
    /// <param name="voice">Voice name (e.g., "en-US-AvaMultilingualNeural")</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Audio data as byte array</returns>
    Task<byte[]> TextToSpeechAsync(
        string text, 
        string? voice = null, 
        CancellationToken cancellationToken = default);
}
