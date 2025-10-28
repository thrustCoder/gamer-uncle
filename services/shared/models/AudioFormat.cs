namespace GamerUncle.Shared.Models;

/// <summary>
/// Supported audio formats for voice processing
/// </summary>
public enum AudioFormat
{
    /// <summary>
    /// WAV file format (includes 44-byte header)
    /// </summary>
    Wav,

    /// <summary>
    /// Raw PCM16 data (no header, 16-bit signed integers at 24kHz mono)
    /// </summary>
    Pcm16
}
