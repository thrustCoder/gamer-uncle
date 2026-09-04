using System.Diagnostics.Metrics;
using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Services.Speech;
using GamerUncle.Shared.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace GamerUncle.Api.Tests.Speech;

/// <summary>
/// Unit tests for <see cref="AudioProcessingService"/> metric emission.
///
/// Regression coverage for the Alert #11/#12 investigation: a user tapping the mic and
/// releasing before speaking used to increment voice.audio_failures_total, making user-input
/// errors indistinguishable from genuine pipeline faults (Speech/agent outages).
/// </summary>
public class AudioProcessingServiceTests
{
    private const string MeterName = "GamerUncle.VoiceProcessing";
    private const string FailureCounter = "voice.audio_failures_total";
    private const string NoSpeechCounter = "voice.no_speech_total";
    private const string RequestCounter = "voice.audio_requests_total";
    private const string TotalDurationHistogram = "voice.total_duration_ms";

    private readonly Mock<IAzureSpeechService> _speechService = new();
    private readonly Mock<IAgentServiceClient> _agentService = new();

    private AudioProcessingService CreateSut() => new(
        _speechService.Object,
        _agentService.Object,
        NullLogger<AudioProcessingService>.Instance);

    /// <summary>
    /// Captures counter/histogram emissions from the voice meter for the duration of a test.
    /// </summary>
    private sealed class MetricCapture : IDisposable
    {
        private readonly MeterListener _listener;
        private readonly object _lock = new();

        public List<(string Name, long Value)> LongMeasurements { get; } = new();
        public List<(string Name, double Value)> DoubleMeasurements { get; } = new();

        public MetricCapture()
        {
            _listener = new MeterListener
            {
                InstrumentPublished = (instrument, listener) =>
                {
                    if (instrument.Meter.Name == MeterName)
                    {
                        listener.EnableMeasurementEvents(instrument);
                    }
                }
            };

            _listener.SetMeasurementEventCallback<long>((instrument, value, _, _) =>
            {
                lock (_lock)
                {
                    LongMeasurements.Add((instrument.Name, value));
                }
            });

            _listener.SetMeasurementEventCallback<double>((instrument, value, _, _) =>
            {
                lock (_lock)
                {
                    DoubleMeasurements.Add((instrument.Name, value));
                }
            });

            _listener.Start();
        }

        public long CountFor(string instrumentName)
        {
            lock (_lock)
            {
                return LongMeasurements.Where(m => m.Name == instrumentName).Sum(m => m.Value);
            }
        }

        public bool HasDouble(string instrumentName)
        {
            lock (_lock)
            {
                return DoubleMeasurements.Any(m => m.Name == instrumentName);
            }
        }

        public void Dispose() => _listener.Dispose();
    }

    #region No-speech is not a service failure

    [Fact]
    public async Task ProcessAudioAsync_WhenSpeechServiceReportsNoSpeech_DoesNotIncrementFailureCounter()
    {
        // Arrange: STT rejects the clip because the user recorded silence.
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new NoSpeechRecognizedException("No speech could be recognized in the audio"));

        using var capture = new MetricCapture();
        var sut = CreateSut();

        // Act
        await Assert.ThrowsAsync<NoSpeechRecognizedException>(
            () => sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav));

        // Assert
        Assert.Equal(0, capture.CountFor(FailureCounter));
        Assert.Equal(1, capture.CountFor(NoSpeechCounter));
    }

    [Fact]
    public async Task ProcessAudioAsync_WhenTranscriptionIsWhitespace_RecordsNoSpeechNotFailure()
    {
        // Arrange: STT succeeds at the transport level but yields nothing usable.
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("   ");

        using var capture = new MetricCapture();
        var sut = CreateSut();

        // Act
        await Assert.ThrowsAsync<NoSpeechRecognizedException>(
            () => sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav));

        // Assert
        Assert.Equal(0, capture.CountFor(FailureCounter));
        Assert.Equal(1, capture.CountFor(NoSpeechCounter));
    }

    [Fact]
    public async Task NoSpeechRecognizedException_IsInvalidOperationException_SoControllerStillReturns400()
    {
        // Guards the HTTP contract: VoiceController maps InvalidOperationException to 400.
        // Older mobile clients depend on that status code for the "didn't catch that" UX.
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new NoSpeechRecognizedException("No speech could be recognized in the audio"));

        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<NoSpeechRecognizedException>(
            () => sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav));

        Assert.IsAssignableFrom<InvalidOperationException>(ex);
    }

    #endregion

    #region Genuine failures still counted

    [Fact]
    public async Task ProcessAudioAsync_WhenSpeechServiceThrowsRealError_IncrementsFailureCounter()
    {
        // Arrange: a genuine Speech service outage must still page.
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Speech endpoint unreachable"));

        using var capture = new MetricCapture();
        var sut = CreateSut();

        // Act
        await Assert.ThrowsAsync<HttpRequestException>(
            () => sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav));

        // Assert
        Assert.Equal(1, capture.CountFor(FailureCounter));
        Assert.Equal(0, capture.CountFor(NoSpeechCounter));
    }

    [Fact]
    public async Task ProcessAudioAsync_WhenAgentReturnsEmptyResponse_IncrementsFailureCounter()
    {
        // Arrange: agent produced nothing — a real pipeline fault, not user input.
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("How do I win at Catan?");
        _agentService
            .Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<GameQueryCriteria>(), It.IsAny<string>()))
            .ReturnsAsync(new AgentResponse { ResponseText = "", ThreadId = "thread_1" });

        using var capture = new MetricCapture();
        var sut = CreateSut();

        // Act
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav));

        // Assert
        Assert.Equal(1, capture.CountFor(FailureCounter));
        Assert.Equal(0, capture.CountFor(NoSpeechCounter));
    }

    [Fact]
    public async Task ProcessAudioAsync_WhenTtsThrows_IncrementsFailureCounter()
    {
        // Arrange
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("How do I win at Catan?");
        _agentService
            .Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<GameQueryCriteria>(), It.IsAny<string>()))
            .ReturnsAsync(new AgentResponse { ResponseText = "Build roads.", ThreadId = "thread_1" });
        _speechService
            .Setup(s => s.TextToSpeechAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("TTS timed out"));

        using var capture = new MetricCapture();
        var sut = CreateSut();

        // Act
        await Assert.ThrowsAsync<TimeoutException>(
            () => sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav));

        // Assert
        Assert.Equal(1, capture.CountFor(FailureCounter));
        Assert.Equal(0, capture.CountFor(NoSpeechCounter));
    }

    #endregion

    #region Happy path

    [Fact]
    public async Task ProcessAudioAsync_OnSuccess_RecordsDurationAndNoFailureMetrics()
    {
        // Arrange
        var audio = new byte[] { 1, 2, 3, 4 };
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("How do I win at Catan?");
        _agentService
            .Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<GameQueryCriteria>(), It.IsAny<string>()))
            .ReturnsAsync(new AgentResponse { ResponseText = "Build roads.", ThreadId = "thread_abc" });
        _speechService
            .Setup(s => s.TextToSpeechAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(audio);

        using var capture = new MetricCapture();
        var sut = CreateSut();

        // Act
        var result = await sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav);

        // Assert
        Assert.Equal("How do I win at Catan?", result.TranscribedText);
        Assert.Equal("Build roads.", result.ResponseText);
        Assert.Equal(audio, result.ResponseAudio);
        Assert.Equal("thread_abc", result.ConversationId);

        Assert.Equal(1, capture.CountFor(RequestCounter));
        Assert.Equal(0, capture.CountFor(FailureCounter));
        Assert.Equal(0, capture.CountFor(NoSpeechCounter));
        Assert.True(capture.HasDouble(TotalDurationHistogram),
            "voice.total_duration_ms must be recorded on the success path — it backs Alert #12.");
    }

    [Fact]
    public async Task ProcessAudioAsync_WithGameContext_PrependsContextToAgentQuery()
    {
        // Arrange
        _speechService
            .Setup(s => s.SpeechToTextAsync(It.IsAny<string>(), It.IsAny<AudioFormat>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("What is the setup?");
        _agentService
            .Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<GameQueryCriteria>(), It.IsAny<string>()))
            .ReturnsAsync(new AgentResponse { ResponseText = "Place settlements.", ThreadId = "thread_ctx" });
        _speechService
            .Setup(s => s.TextToSpeechAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 9 });

        var sut = CreateSut();

        // Act
        await sut.ProcessAudioAsync("dGVzdA==", AudioFormat.Wav, gameContext: "For the game Catan:");

        // Assert
        _agentService.Verify(
            a => a.GetRecommendationsAsync(
                "For the game Catan: What is the setup?",
                It.IsAny<string>(),
                It.IsAny<GameQueryCriteria>(),
                It.IsAny<string>()),
            Times.Once);
    }

    #endregion
}
