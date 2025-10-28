namespace GamerUncle.Shared.Models;

/// <summary>
/// Response model for audio processing endpoint
/// </summary>
public class AudioResponse
{
    /// <summary>
    /// Transcribed text from user's audio (STT result)
    /// </summary>
    public string Transcription { get; set; } = string.Empty;

    /// <summary>
    /// AI-generated response text
    /// </summary>
    public string ResponseText { get; set; } = string.Empty;

    /// <summary>
    /// Base64-encoded TTS audio data (AI's spoken response)
    /// </summary>
    public string AudioData { get; set; } = string.Empty;

    /// <summary>
    /// Conversation ID linking this interaction to text conversation
    /// </summary>
    public string ConversationId { get; set; } = string.Empty;
}
