using Microsoft.CognitiveServices.Speech;
using Microsoft.CognitiveServices.Speech.Audio;
using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Speech;

/// <summary>
/// Azure Speech Services implementation for STT and TTS
/// </summary>
public class AzureSpeechService : IAzureSpeechService
{
    private readonly SpeechConfig _speechConfig;
    private readonly ILogger<AzureSpeechService> _logger;
    private readonly string _defaultVoice;

    public AzureSpeechService(
        IConfiguration configuration,
        ILogger<AzureSpeechService> logger)
    {
        _logger = logger;

        // Get Azure Speech configuration
        var speechKey = configuration["AzureSpeech:Key"] 
            ?? throw new InvalidOperationException("AzureSpeech:Key configuration is missing");
        var speechRegion = configuration["AzureSpeech:Region"] 
            ?? throw new InvalidOperationException("AzureSpeech:Region configuration is missing");
        _defaultVoice = configuration["AzureSpeech:DefaultVoice"] ?? "en-US-AvaMultilingualNeural";

        _speechConfig = SpeechConfig.FromSubscription(speechKey, speechRegion);
        
        _logger.LogInformation("AzureSpeechService initialized with region: {Region}, default voice: {Voice}", 
            speechRegion, _defaultVoice);
    }

    /// <inheritdoc/>
    public async Task<string> SpeechToTextAsync(
        string audioBase64, 
        AudioFormat format, 
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting STT processing. Format: {Format}, Audio size: {Size} bytes", 
            format, audioBase64.Length);

        try
        {
            // Convert base64 to byte array
            var audioBytes = Convert.FromBase64String(audioBase64);
            
            // If Wav format, skip the 44-byte WAV header to get raw PCM16 data
            if (format == AudioFormat.Wav && audioBytes.Length > 44)
            {
                var pcmData = new byte[audioBytes.Length - 44];
                Array.Copy(audioBytes, 44, pcmData, 0, pcmData.Length);
                audioBytes = pcmData;
                _logger.LogDebug("Stripped WAV header, PCM data size: {Size} bytes", audioBytes.Length);
            }

            // Create audio stream from PCM16 data
            using var audioStream = new MemoryStream(audioBytes);
            
            // Configure audio format (PCM16, 24kHz, mono, 16-bit)
            var audioFormat = AudioStreamFormat.GetWaveFormatPCM(24000, 16, 1);
            using var audioInput = AudioConfig.FromStreamInput(
                new BinaryAudioStreamReader(audioStream), 
                audioFormat);

            // Create speech recognizer
            using var recognizer = new SpeechRecognizer(_speechConfig, audioInput);

            // Perform recognition
            var result = await recognizer.RecognizeOnceAsync();

            if (result.Reason == ResultReason.RecognizedSpeech)
            {
                _logger.LogInformation("STT successful. Transcription: {Transcription}", result.Text);
                return result.Text;
            }
            else if (result.Reason == ResultReason.NoMatch)
            {
                _logger.LogWarning("STT: No speech could be recognized");
                throw new InvalidOperationException("No speech could be recognized in the audio");
            }
            else if (result.Reason == ResultReason.Canceled)
            {
                var cancellation = CancellationDetails.FromResult(result);
                _logger.LogError("STT canceled. Reason: {Reason}, ErrorCode: {ErrorCode}, ErrorDetails: {ErrorDetails}",
                    cancellation.Reason, cancellation.ErrorCode, cancellation.ErrorDetails);
                throw new InvalidOperationException($"Speech recognition was canceled: {cancellation.ErrorDetails}");
            }

            throw new InvalidOperationException($"Unexpected speech recognition result: {result.Reason}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during STT processing");
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<byte[]> TextToSpeechAsync(
        string text, 
        string? voice = null, 
        CancellationToken cancellationToken = default)
    {
        var selectedVoice = voice ?? _defaultVoice;
        _logger.LogInformation("Starting TTS processing. Text length: {Length}, Voice: {Voice}", 
            text.Length, selectedVoice);

        try
        {
            // Configure voice
            _speechConfig.SpeechSynthesisVoiceName = selectedVoice;

            // Create synthesizer (null audio config means return data instead of playing)
            using var synthesizer = new SpeechSynthesizer(_speechConfig, null);

            // Synthesize speech
            var result = await synthesizer.SpeakTextAsync(text);

            if (result.Reason == ResultReason.SynthesizingAudioCompleted)
            {
                _logger.LogInformation("TTS successful. Audio size: {Size} bytes", result.AudioData.Length);
                return result.AudioData;
            }
            else if (result.Reason == ResultReason.Canceled)
            {
                var cancellation = SpeechSynthesisCancellationDetails.FromResult(result);
                _logger.LogError("TTS canceled. Reason: {Reason}, ErrorCode: {ErrorCode}, ErrorDetails: {ErrorDetails}",
                    cancellation.Reason, cancellation.ErrorCode, cancellation.ErrorDetails);
                throw new InvalidOperationException($"Speech synthesis was canceled: {cancellation.ErrorDetails}");
            }

            throw new InvalidOperationException($"Unexpected speech synthesis result: {result.Reason}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during TTS processing");
            throw;
        }
    }

    /// <summary>
    /// Helper class to read audio data from a stream for Azure Speech SDK
    /// </summary>
    private class BinaryAudioStreamReader : PullAudioInputStreamCallback
    {
        private readonly Stream _stream;

        public BinaryAudioStreamReader(Stream stream)
        {
            _stream = stream;
        }

        public override int Read(byte[] dataBuffer, uint size)
        {
            return _stream.Read(dataBuffer, 0, (int)size);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _stream?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
