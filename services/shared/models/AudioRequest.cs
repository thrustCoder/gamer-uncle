using System.ComponentModel.DataAnnotations;

namespace GamerUncle.Shared.Models;

/// <summary>
/// Request model for audio processing endpoint
/// </summary>
public class AudioRequest
{
    /// <summary>
    /// Base64-encoded audio data from user
    /// </summary>
    [Required(ErrorMessage = "AudioData is required")]
    public string AudioData { get; set; } = string.Empty;

    /// <summary>
    /// Audio format (Wav or Pcm16)
    /// </summary>
    [Required(ErrorMessage = "Format is required")]
    public AudioFormat Format { get; set; }

    /// <summary>
    /// Optional conversation ID to link with existing text conversation
    /// </summary>
    public string? ConversationId { get; set; }
}
