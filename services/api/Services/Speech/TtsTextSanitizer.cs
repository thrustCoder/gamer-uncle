using System.Text.RegularExpressions;

namespace GamerUncle.Api.Services.Speech;

/// <summary>
/// Utility class to sanitize text for Text-to-Speech (TTS) processing.
/// Removes emojis, markdown formatting, and other visual elements that
/// should not be spoken while preserving meaningful content.
/// </summary>
public static partial class TtsTextSanitizer
{
    // Emoji patterns - covers most common emoji ranges using .NET compatible syntax
    // Uses surrogate pairs for emoji ranges above U+FFFF
    // Includes: emoticons, symbols, dingbats, variation selectors, ZWJ, misc symbols
    private static readonly Regex _emojiRegex = new(
        @"[\uD83C-\uDBFF][\uDC00-\uDFFF]|" +  // Surrogate pairs (most emojis)
        @"[\u2600-\u26FF]|" +                   // Misc symbols (☀️⛄♠️ etc)
        @"[\u2700-\u27BF]|" +                   // Dingbats (✂️✈️ etc)
        @"[\u2300-\u23FF]|" +                   // Misc technical (⏰⏱️⌚ etc)
        @"[\u2190-\u21FF]|" +                   // Arrows
        @"[\u25A0-\u25FF]|" +                   // Geometric shapes
        @"[\uFE00-\uFE0F]|" +                   // Variation selectors
        @"\u200D|" +                            // Zero-width joiner
        @"[\u231A-\u231B]|" +                   // Watch & hourglass
        @"[\u23E9-\u23F3]|" +                   // Media control symbols
        @"[\u23F8-\u23FA]",                     // More media symbols
        RegexOptions.Compiled);

    // Markdown header patterns (# Header, ## Header, etc.)
    [GeneratedRegex(@"^#{1,6}\s*", RegexOptions.Multiline)]
    private static partial Regex MarkdownHeaderRegex();

    // Markdown bold/italic patterns - handles *italic*, **bold**, ***both***, and underscore variants
    // Applied multiple times to handle nested formatting
    [GeneratedRegex(@"(\*{1,3}|_{1,3})([^*_]+)\1")]
    private static partial Regex MarkdownBoldItalicRegex();

    // Markdown bullet points (- item, * item, + item)
    [GeneratedRegex(@"^[\s]*[-*+]\s+", RegexOptions.Multiline)]
    private static partial Regex MarkdownBulletRegex();

    // Markdown numbered lists (1. item, 2. item)
    [GeneratedRegex(@"^[\s]*\d+\.\s+", RegexOptions.Multiline)]
    private static partial Regex MarkdownNumberedListRegex();

    // Markdown inline code (`code`)
    [GeneratedRegex(@"`([^`]+)`")]
    private static partial Regex MarkdownInlineCodeRegex();

    // Markdown code blocks (```code```)
    [GeneratedRegex(@"```[\s\S]*?```", RegexOptions.Multiline)]
    private static partial Regex MarkdownCodeBlockRegex();

    // Markdown links [text](url) - keep text, remove url
    [GeneratedRegex(@"\[([^\]]+)\]\([^)]+\)")]
    private static partial Regex MarkdownLinkRegex();

    // Multiple consecutive newlines
    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex MultipleNewlinesRegex();

    // Multiple consecutive spaces
    [GeneratedRegex(@"[ ]{2,}")]
    private static partial Regex MultipleSpacesRegex();

    /// <summary>
    /// Removes emojis from text while preserving all other content.
    /// </summary>
    /// <param name="text">The input text potentially containing emojis.</param>
    /// <returns>Text with emojis removed.</returns>
    public static string StripEmojis(string text)
    {
        if (string.IsNullOrEmpty(text))
            return text;

        return _emojiRegex.Replace(text, "").Trim();
    }

    /// <summary>
    /// Removes markdown formatting while preserving the underlying text content.
    /// Headers, bold, italic, bullets, and other formatting are stripped.
    /// </summary>
    /// <param name="text">The input text potentially containing markdown.</param>
    /// <returns>Plain text with markdown formatting removed.</returns>
    public static string StripMarkdown(string text)
    {
        if (string.IsNullOrEmpty(text))
            return text;

        var result = text;

        // Remove code blocks first (before other processing)
        result = MarkdownCodeBlockRegex().Replace(result, "");

        // Remove headers (# Header -> Header)
        result = MarkdownHeaderRegex().Replace(result, "");

        // Remove bold/italic markers but keep content (apply multiple times for nested patterns)
        for (int i = 0; i < 3; i++)
        {
            result = MarkdownBoldItalicRegex().Replace(result, "$2");
        }

        // Remove inline code markers but keep content
        result = MarkdownInlineCodeRegex().Replace(result, "$1");

        // Convert bullet points to natural speech pauses
        result = MarkdownBulletRegex().Replace(result, "");

        // Convert numbered lists to natural speech
        result = MarkdownNumberedListRegex().Replace(result, "");

        // Convert links to just the text
        result = MarkdownLinkRegex().Replace(result, "$1");

        // Clean up excessive whitespace
        result = MultipleNewlinesRegex().Replace(result, "\n\n");
        result = MultipleSpacesRegex().Replace(result, " ");

        return result.Trim();
    }

    /// <summary>
    /// Fully sanitizes text for TTS by removing both emojis and markdown formatting.
    /// This is the primary method to use before sending text to speech synthesis.
    /// </summary>
    /// <param name="text">The input text to sanitize.</param>
    /// <returns>Clean text suitable for TTS.</returns>
    public static string SanitizeForTts(string text)
    {
        if (string.IsNullOrEmpty(text))
            return text;

        var result = StripEmojis(text);
        result = StripMarkdown(result);

        return result;
    }
}
