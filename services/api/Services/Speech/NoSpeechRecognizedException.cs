namespace GamerUncle.Api.Services.Speech;

/// <summary>
/// Thrown when the audio payload contained no recognizable speech.
/// </summary>
/// <remarks>
/// This is a <b>user-input</b> condition (e.g. the mic button was tapped and released
/// before the user spoke), not a service failure. It is tracked separately from
/// <c>voice.audio_failures_total</c> so that Alert #11 only fires on genuine pipeline
/// faults such as Speech service or agent outages.
///
/// Derives from <see cref="InvalidOperationException"/> so existing handlers that map
/// business-rule violations to HTTP 400 continue to work unchanged.
/// </remarks>
public class NoSpeechRecognizedException : InvalidOperationException
{
    public NoSpeechRecognizedException(string message) : base(message)
    {
    }

    public NoSpeechRecognizedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
